import assert from 'node:assert/strict';
import {test} from 'node:test';
import {stayDates,priceBreakdown} from '../lib/booking.ts';
test('date ranges exclude checkout and cross month boundaries',()=>assert.deepEqual(stayDates('2027-01-30','2027-02-02','2027-01-01'),['2027-01-30','2027-01-31','2027-02-01']));
test('invalid, reversed, past and excessive dates are rejected',()=>{for(const pair of [['2027-02-30','2027-03-03'],['2027-01-03','2027-01-02'],['2026-01-01','2026-01-02'],['2027-01-01','2027-05-01'],['invalid','2027-01-02']])assert.throws(()=>stayDates(...pair,'2027-01-01'));});
test('price is calculated in cents including cleaning and service fee',()=>assert.deepEqual(priceBreakdown(165,3),{subtotal:49500,cleaning:2500,service:5940,total:57940}));
