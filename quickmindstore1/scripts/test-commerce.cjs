const assert=require('node:assert/strict'),engine=require('../dist/commerce-engine.js');
for(const [code,expected] of [['',249800],['QM90',224820],['QM80',199840],['QM50',124900]]){const q=engine.quote({code});assert.equal(q.productCents,expected);assert.equal(q.discountCents+q.productCents,q.originalCents);assert.equal(q.lines.reduce((s,l)=>s+l.netCents,0),q.productCents);assert.equal(q.taxCents,null);assert.equal(q.shippingCents,null);assert.equal(engine.quote({code,quantity:3}).productCents,expected*3)}
assert.equal(engine.quote({code:' qm80 '}).productCents,199840);
for(const code of ['BAD','QM90+QM50','<script>'])assert.throws(()=>engine.quote({code}),/INVALID_COUPON/);
for(const quantity of [0,-1,1.1,10001,NaN,'2'])assert.throws(()=>engine.quote({quantity}),/INVALID_QUANTITY/);
assert.equal(engine.commission({paidProductCents:199840,commissionBasisPoints:1000}),19984);
assert.equal(engine.commission({paidProductCents:199840,refundedProductCents:50000,commissionBasisPoints:1000}),14984);
assert.equal(engine.commission({paidProductCents:199840,refundedProductCents:199840,commissionBasisPoints:1000}),0);
assert.throws(()=>engine.commission({paidProductCents:100,refundedProductCents:101,commissionBasisPoints:1000}),/INVALID_COMMISSION/);
assert.throws(()=>engine.commission({paidProductCents:100,commissionBasisPoints:undefined}),/INVALID_COMMISSION/);
const registry=[{id:'US-A',status:'ACTIVE'},{id:'US-B',status:'ACTIVE'},{id:'US-C',status:'PAUSED'}],now=Date.UTC(2026,9,11);
const first=engine.qualifyReferral({registry,requested:'US-A',now});assert.equal(first.dealerId,'US-A');assert.equal(engine.qualifyReferral({registry,requested:'US-B',existing:first,now:now+86400000}).dealerId,'US-A');assert.equal(engine.qualifyReferral({registry,requested:'US-B',existing:first,now:now+86400000,explicit:true}).dealerId,'US-B');assert.equal(engine.qualifyReferral({registry,requested:'US-B',existing:first,now:now+31*86400000}).dealerId,'US-B');assert.equal(engine.qualifyReferral({registry,requested:'US-C',now}),null);assert.equal(engine.qualifyReferral({registry,requested:'US-MADE-UP',now}),null);
console.log('Discount ratios, quantity/invalid input, cents conservation, configurable commissions, partial/full refund and dealer attribution conflicts/expiry passed.');
