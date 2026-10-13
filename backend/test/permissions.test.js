import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePermissions,can,canReadAll,routePermission,permissionModules} from '../dist/services/permissions.js';
test('role grants combine and user denial takes priority',()=>{const p=resolvePermissions([{RID:1,name:'membre'},{RID:2,name:'president'}],{1:{charges:{create:true}},2:{charges:{create:false}}},{charges:{create:false}});assert.equal(p.charges.create,false);assert.equal(p.loans.read_all,true);assert.equal(p.employees.read_all,true);});
test('inherit defaults and remove user override',()=>{const roles=[{RID:1,name:'membre'}],custom={1:{charges:{read:true,create:true}}};assert.equal(resolvePermissions(roles,custom).charges.create,true);assert.equal(resolvePermissions(roles,custom,{charges:{read:false}}).charges.read,false);assert.equal(resolvePermissions(roles,custom).charges.read,true);});
test('read all requires read; admin retains access',()=>{assert.equal(canReadAll({roles:['membre'],permissions:{employees:{read_all:true,read:false}}},'employees'),false);assert.equal(can({roles:['admin']},'users','create'),true);assert.equal(can({roles:[],permissions:{}},'users','create'),false);});
test('specific business routes map to correct permission',()=>{for(const [path,method,module,action] of [['/payments/2/pay','POST','repayments','pay'],['/employees/import/preview','POST','employees','import'],['/loans/2/sign','POST','loans','sign'],['/exports/charges','GET','charges','export'],['/contributions/month/preview','GET','contributions','generate']])assert.deepEqual(routePermission({path,method}),{module,action});});
test('user account status and deletion use update and admin-only delete permissions',()=>{assert.deepEqual(routePermission({path:'/users/2/status',method:'PATCH'}),{module:'users',action:'update'});assert.deepEqual(routePermission({path:'/users/2',method:'DELETE'}),{module:'users',action:'delete'});assert.equal(permissionModules.users.actions.includes('delete'),false);assert.equal(can({roles:['membre'],permissions:{users:{update:true}}},'users','delete'),false);});

test('default roles separate personal access, personnel management, control and finance',()=>{
 const permissions=name=>resolvePermissions([{RID:1,name}]);
 const member=permissions('membre');assert.equal(member.employees.read_all,false);assert.equal(member.loans.reject,false);assert.equal(member.loans.sign,true);assert.equal(member.users.read,false);
 const personnel=permissions('chef_personnel');assert.equal(personnel.employees.import,true);assert.equal(personnel.employees.update,true);assert.equal(personnel.closures.close,false);assert.equal(personnel.repayments.pay,false);
 const control=permissions('commissaire');assert.equal(control.audit.read,true);assert.equal(control.reports.read,true);assert.equal(control.contributions.update,false);assert.equal(control.charges.delete,false);
 const president=permissions('president');assert.equal(president.closures.close,true);assert.equal(president.repayments.pay,true);assert.equal(president.users.create,false);
 for(const module of Object.values(permissions('unknown'))) assert.equal(Object.values(module).some(Boolean),false);
});
