export function stayDates(checkIn:unknown,checkOut:unknown,today=new Date().toISOString().slice(0,10)){
 if(typeof checkIn!=='string'||typeof checkOut!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)||!/^\d{4}-\d{2}-\d{2}$/.test(checkOut))throw new Error('Choose your check-in and check-out dates.');
 const start=Date.parse(checkIn+'T00:00:00Z'),end=Date.parse(checkOut+'T00:00:00Z');
 if(!Number.isFinite(start)||!Number.isFinite(end)||new Date(start).toISOString().slice(0,10)!==checkIn||new Date(end).toISOString().slice(0,10)!==checkOut)throw new Error('Choose valid dates.');
 const count=(end-start)/86400000;
 if(checkIn<today||count<1||count>90)throw new Error('Choose a future stay between 1 and 90 nights.');
 if(start>Date.parse(today+'T00:00:00Z')+730*86400000)throw new Error('Book within the next two years.');
 return Array.from({length:count},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
}
export function priceBreakdown(nightly:number,nights:number){const subtotal=Math.round(nightly*100)*nights;const cleaning=2500;const service=Math.round(subtotal*.12);return{subtotal,cleaning,service,total:subtotal+cleaning+service};}
