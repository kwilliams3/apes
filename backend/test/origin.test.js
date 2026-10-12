import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedOrigin} from '../server/origin.js';

test('same-origin requests from a LAN host are allowed',()=>{
 assert.equal(isAllowedOrigin('http://192.168.1.25:5173','192.168.1.25:5173','http://localhost:5173',3017),true);
 assert.equal(isAllowedOrigin('http://apes-server:3017','apes-server:3017','http://localhost:5173',3017),true);
});
test('configured and loopback development origins remain allowed',()=>{
 assert.equal(isAllowedOrigin('http://localhost:5173','127.0.0.1:5173','http://localhost:5173',3017),true);
 assert.equal(isAllowedOrigin('http://192.168.1.25:5173','192.168.1.25:5173','http://192.168.1.25:5173',3017),true);
});
test('unrelated origins are rejected',()=>{
 assert.equal(isAllowedOrigin('https://attacker.example','apes-server:3017','http://localhost:5173',3017),false);
 assert.equal(isAllowedOrigin('http://192.168.1.25:5174','192.168.1.25:5173','http://localhost:5173',3017),false);
});
