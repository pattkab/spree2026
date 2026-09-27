import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://localhost:5173';
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,'Tests only run against local development');
const signed=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=signed.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
assert.ok(cookie,'Local mock authentication cookie');
async function request(body,auth=true,origin=base){const r=await fetch(base+'/api/market',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(auth?{Cookie:cookie}:{})},body:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={error:text}}return{...data,httpStatus:r.status};}
async function get(resource,auth=true){const r=await fetch(base+'/api/market?'+resource,{headers:auth?{Cookie:cookie}:{}});assert.equal(r.status,200,await r.clone().text());return r.json();}
const catalog=await get('resource=catalog');assert.ok(catalog.stays.length>=8);
assert.equal((await request({action:'favorite',id:'bali-canopy',saved:true},false)).httpStatus,401);
assert.equal((await request({action:'favorite',id:'bali-canopy',saved:true},true,'https://evil.example')).httpStatus,403);
assert.equal((await request({action:'favorite',id:'bali-canopy',saved:true})).httpStatus,200);
assert.ok((await get('resource=catalog')).favorites.includes('bali-canopy'));
await request({action:'favorite',id:'bali-canopy',saved:false});
const start=new Date();start.setUTCDate(start.getUTCDate()+400);const end=new Date(start);end.setUTCDate(end.getUTCDate()+3);
const payload={action:'book',id:'bali-canopy',checkIn:start.toISOString().slice(0,10),checkOut:end.toISOString().slice(0,10),guests:2,total:1};
assert.equal((await request({...payload,guests:99})).httpStatus,400);
assert.equal((await request({...payload,checkIn:'2020-01-01'})).httpStatus,400);
for(const b of (await get('resource=trips')).bookings){if(b.check_in===payload.checkIn&&b.stay.id===payload.id&&b.status==='confirmed')await request({action:'cancel',id:b.id});}
const before=(await get('resource=trips')).bookings.length;
const attempts=await Promise.all([request(payload),request(payload)]);
assert.deepEqual(attempts.map(a=>a.httpStatus).sort(),[201,409]);
const booking=attempts.find(a=>a.httpStatus===201);assert.equal(booking.total,57940,'Client total is ignored');
assert.equal((await get('resource=trips')).bookings.length,before+1,'Failed overlap rolled back entire booking');
assert.ok((await get(`resource=catalog&checkIn=${payload.checkIn}&checkOut=${payload.checkOut}`)).unavailable.includes('bali-canopy'));
assert.equal((await request({action:'review',id:booking.id,rating:5,body:'A beautiful stay with thoughtful details.'})).httpStatus,400,'Cannot review before checkout');
assert.equal((await request({action:'cancel',id:booking.id})).httpStatus,200);
assert.equal((await request({action:'cancel',id:booking.id})).httpStatus,200,'Cancellation is idempotent');
assert.ok(!(await get(`resource=catalog&checkIn=${payload.checkIn}&checkOut=${payload.checkOut}`)).unavailable.includes('bali-canopy'));
const listing={...catalog.stays[0],title:'QA test home',description:'A local test listing created to verify the hosting workflow.'};
assert.equal((await request({action:'listing',id:'bali-canopy',listing})).httpStatus,403,'Cannot edit another host listing');
const created=await request({action:'listing',listing});assert.equal(created.httpStatus,201);
assert.equal((await request({...payload,id:created.id})).httpStatus,400,'Hosts cannot book their own home');
assert.equal((await request({action:'listing',id:created.id,listing:{...listing,title:'QA updated home',price:199}})).httpStatus,200);
assert.equal((await get('resource=host')).listings.find(l=>l.id===created.id).price,199);
assert.equal((await request({action:'toggleListing',id:created.id,active:false})).httpStatus,200);
assert.ok(!(await get('resource=catalog')).stays.some(s=>s.id===created.id));
assert.equal((await request({...payload,id:created.id})).httpStatus,404);
console.log('PASS: catalog, authentication, CSRF, favorites, date and guest validation, server pricing, atomic booking conflict, rollback, cancellation, review eligibility, listing ownership, create/edit/pause.');
console.log('Local test artifacts: one cancelled reservation and one paused QA listing.');


