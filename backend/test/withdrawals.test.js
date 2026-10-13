import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWithdrawalAmount,canManageWithdrawals} from '../dist/services/withdrawals.js';
import {resolvePermissions} from '../dist/services/permissions.js';
test('retrait strictement inferieur au solde disponible',()=>{validateWithdrawalAmount(999.99,1000);for(const amount of [0,-1,1000,1001,NaN,1.001])assert.throws(()=>validateWithdrawalAmount(amount,1000));});
test('seuls admin et chef du personnel valident et versent les retraits',()=>{for(const name of ['admin','chef_personnel'])assert.equal(canManageWithdrawals({roles:[name]}),true);for(const name of ['membre','president','commissaire']){assert.equal(canManageWithdrawals({roles:[name]}),false);assert.equal(resolvePermissions([{RID:1,name}]).withdrawals.approve,false);}const chief=resolvePermissions([{RID:1,name:'chef_personnel'}]);assert.equal(chief.withdrawals.approve,true);assert.equal(chief.withdrawals.pay,true);assert.equal(chief.withdrawals.read_all,true);});
