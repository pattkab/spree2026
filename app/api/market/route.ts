import {getChatGPTUser} from '../../chatgpt-auth';
import {database} from '../../../db/store';
import {stays,categories,type Stay} from '../../data';
import {stayDates,priceBreakdown} from '../../../lib/booking';
import {z} from 'zod';
export const dynamic='force-dynamic';
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const listingSchema=z.object({title:z.string().trim().min(3).max(80),location:z.string().trim().min(2).max(80),country:z.string().trim().min(2).max(80),category:z.enum(categories.slice(1) as [string,...string[]]),price:z.number().int().min(10).max(10000),guests:z.number().int().min(1).max(16),beds:z.number().int().min(1).max(16),baths:z.number().int().min(1).max(16),image:z.string().url().max(2000).refine(v=>v.startsWith('https://'),'Use a secure HTTPS image URL'),description:z.string().trim().min(30).max(3000),amenities:z.array(z.enum(['Pool','Wi-Fi','Kitchen','Free parking','Air conditioning','Garden','Workspace','Heating','Fireplace'])).min(1).max(9)});
async function seed(){const db=database();await db.batch(stays.map(s=>db.prepare('INSERT OR IGNORE INTO listings (id,owner_id,data,active) VALUES (?,?,?,1)').bind(s.id,'demo-host',JSON.stringify(s))));return db;}
function unpack(row:Record<string,unknown>):Stay{return{...JSON.parse(String(row.data)),active:row.active};}
async function find(id:string){const row=await database().prepare('SELECT * FROM listings WHERE id=?').bind(id).first<Record<string,unknown>>();return row?{...unpack(row),owner_id:String(row.owner_id)}:null;}
export async function GET(request:Request){try{
 const db=await seed();const url=new URL(request.url);const kind=url.searchParams.get('resource')||'catalog';const user=await getChatGPTUser();
 if(kind==='catalog'){
 const rows=await db.prepare('SELECT * FROM listings WHERE active=1 ORDER BY rowid').all<Record<string,unknown>>();
 const fav=user?await db.prepare('SELECT listing_id FROM favorites WHERE user_id=?').bind(user.userId).all<{listing_id:string}>():{results:[]};
 let unavailable:string[]=[];
 if(url.searchParams.get('checkIn')||url.searchParams.get('checkOut')){const dates=stayDates(url.searchParams.get('checkIn'),url.searchParams.get('checkOut'));const rows=await db.prepare('SELECT DISTINCT listing_id FROM nights WHERE date>=? AND date<=?').bind(dates[0],dates.at(-1)).all<{listing_id:string}>();unavailable=rows.results.map(r=>r.listing_id);}
 return response({stays:rows.results.map(unpack),favorites:fav.results.map(r=>r.listing_id),unavailable});}
 if(kind==='detail'){const id=url.searchParams.get('id')||'';const stay=await find(id);if(!stay||!stay.active)return response({error:'This stay is no longer available.'},404);const occupied=await db.prepare('SELECT date FROM nights WHERE listing_id=? AND date>=? ORDER BY date').bind(id,new Date().toISOString().slice(0,10)).all<{date:string}>();const reviewRows=await db.prepare('SELECT id,name,rating,body,created_at FROM reviews WHERE listing_id=? ORDER BY created_at DESC LIMIT 50').bind(id).all();const {owner_id,...publicStay}=stay;return response({stay:publicStay,occupied:occupied.results.map(r=>r.date),reviews:reviewRows.results,isOwner:owner_id===user?.userId});}
 if(!user)return response({error:'Sign in to continue.'},401);
 if(kind==='trips'){const result=await db.prepare('SELECT b.*,l.data,r.id AS review_id FROM bookings b JOIN listings l ON b.listing_id=l.id LEFT JOIN reviews r ON r.booking_id=b.id WHERE b.user_id=? ORDER BY b.created_at DESC').bind(user.userId).all<Record<string,unknown>>();return response({bookings:result.results.map(r=>({...r,stay:JSON.parse(String(r.data)),data:undefined}))});}
 if(kind==='host'){const listings=await db.prepare('SELECT * FROM listings WHERE owner_id=? ORDER BY rowid DESC').bind(user.userId).all<Record<string,unknown>>();const reservations=await db.prepare('SELECT b.*,l.data FROM bookings b JOIN listings l ON b.listing_id=l.id WHERE l.owner_id=? ORDER BY b.created_at DESC').bind(user.userId).all<Record<string,unknown>>();return response({listings:listings.results.map(unpack),bookings:reservations.results.map(r=>({...r,stay:JSON.parse(String(r.data)),data:undefined}))});}
 return response({error:'Not found'},404);
 }catch(error){console.error('Market read failed',error);return response({error:error instanceof Error&&/Choose|Book within/.test(error.message)?error.message:'We could not load this information. Please try again.'},503);}}
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return response({error:'Invalid request origin.'},403);
 const user=await getChatGPTUser();if(!user)return response({error:'Sign in to continue.'},401);
 if(Number(request.headers.get('content-length')||0)>20000)return response({error:'Request is too large.'},413);
 const raw=await request.text();if(raw.length>20000)return response({error:'Request is too large.'},413);let body;try{body=JSON.parse(raw)}catch{return response({error:'Invalid request.'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'Invalid request.'},400);
 const db=await seed();
 if(body.action==='favorite'){const stay=await find(String(body.id));if(!stay)return response({error:'Stay not found.'},404);if(typeof body.saved!=='boolean')return response({error:'Invalid selection.'},400);await db.prepare(body.saved?'INSERT OR IGNORE INTO favorites (user_id,listing_id) VALUES (?,?)':'DELETE FROM favorites WHERE user_id=? AND listing_id=?').bind(user.userId,stay.id).run();return response({saved:body.saved});}
 if(body.action==='book'){
 const stay=await find(String(body.id));if(!stay||!stay.active)return response({error:'This stay is not available.'},404);if(stay.owner_id===user.userId)return response({error:'You cannot book your own listing.'},400);
 let dates:string[];try{dates=stayDates(body.checkIn,body.checkOut)}catch(e){return response({error:(e as Error).message},400)}
 if(!Number.isInteger(body.guests)||body.guests<1||body.guests>stay.guests)return response({error:`This home accommodates up to ${stay.guests} guests.`},400);
 const id=crypto.randomUUID();const cost=priceBreakdown(stay.price,dates.length);
 try{await db.batch([db.prepare('INSERT INTO bookings (id,user_id,listing_id,guest_name,check_in,check_out,guests,total,nightly,status,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? FROM listings WHERE id=? AND active=1').bind(id,user.userId,stay.id,user.displayName,body.checkIn,body.checkOut,body.guests,cost.total,stay.price*100,'confirmed',new Date().toISOString(),stay.id),...dates.map(date=>db.prepare('INSERT INTO nights (listing_id,date,booking_id) VALUES (?,?,?)').bind(stay.id,date,id))]);}catch(e){if(/UNIQUE|FOREIGN KEY|constraint/i.test(String(e)))return response({error:'Those dates were just booked or the stay is unavailable. Please choose another stay or dates.'},409);throw e;}
 return response({id,total:cost.total,status:'confirmed'},201);}
 if(body.action==='cancel'){
 const booking=await db.prepare('SELECT * FROM bookings WHERE id=? AND user_id=?').bind(String(body.id),user.userId).first<{status:string;check_in:string}>();if(!booking)return response({error:'Reservation not found.'},404);if(booking.status==='cancelled')return response({ok:true});if(booking.check_in<=new Date().toISOString().slice(0,10))return response({error:'Only future reservations can be cancelled.'},400);
 await db.batch([db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND user_id=?").bind(body.id,user.userId),db.prepare('DELETE FROM nights WHERE booking_id=?').bind(body.id)]);return response({ok:true});}
 if(body.action==='listing'){
 const parsed=listingSchema.safeParse(body.listing);if(!parsed.success)return response({error:parsed.error.issues[0].message},400);
 const existing=body.id?await find(String(body.id)):null;if(body.id&&(!existing||existing.owner_id!==user.userId))return response({error:'You do not own this listing.'},403);
 const id=existing?.id||crypto.randomUUID();const listing={...parsed.data,id,host:user.displayName,rating:existing?.rating||0,reviews:existing?.reviews||0};
 if(existing)await db.prepare('UPDATE listings SET data=? WHERE id=? AND owner_id=?').bind(JSON.stringify(listing),id,user.userId).run();else await db.prepare('INSERT INTO listings (id,owner_id,data,active) VALUES (?,?,?,1)').bind(id,user.userId,JSON.stringify(listing)).run();return response({id},existing?200:201);}
 if(body.action==='toggleListing'){if(typeof body.active!=='boolean')return response({error:'Invalid listing status.'},400);const result=await db.prepare('UPDATE listings SET active=? WHERE id=? AND owner_id=?').bind(body.active?1:0,String(body.id),user.userId).run();if(!result.meta.changes)return response({error:'Listing not found.'},404);return response({ok:true});}
 if(body.action==='review'){
 const parsed=z.object({id:z.string(),rating:z.number().int().min(1).max(5),body:z.string().trim().min(10).max(1000)}).safeParse(body);if(!parsed.success)return response({error:'Give a rating and write a review of 10–1,000 characters.'},400);
 const booking=await db.prepare("SELECT * FROM bookings WHERE id=? AND user_id=? AND status='confirmed' AND check_out<=?").bind(body.id,user.userId,new Date().toISOString().slice(0,10)).first<{listing_id:string}>();if(!booking)return response({error:'You can review a stay after checking out.'},400);
 try{await db.prepare('INSERT INTO reviews (id,booking_id,listing_id,user_id,name,rating,body,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),body.id,booking.listing_id,user.userId,user.displayName,body.rating,parsed.data.body,new Date().toISOString()).run()}catch(e){if(/UNIQUE/i.test(String(e)))return response({error:'You have already reviewed this stay.'},409);throw e;}return response({ok:true});}
 return response({error:'Unknown action.'},400);
 }catch(error){console.error('Market write failed',error);return response({error:'We could not save your changes. Please try again.'},503);}}


