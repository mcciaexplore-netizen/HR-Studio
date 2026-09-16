import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { serveClient } from '../server/client';

test('production serves browser assets and returns 404 for hidden and server files', async () => {
  const directory=mkdtempSync(join(tmpdir(),'hrstudio-client-test-')), publicPath=join(directory,'public');
  mkdirSync(publicPath);writeFileSync(join(publicPath,'index.html'),'<h1>HR Studio</h1>');writeFileSync(join(publicPath,'app.js'),'window.test=true');
  writeFileSync(join(directory,'server.cjs'),'private server code');writeFileSync(join(publicPath,'.env'),'private fixture');
  const app=express();serveClient(app,publicPath);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const root=await fetch(origin);assert.equal(root.status,200);assert.match(root.headers.get('content-security-policy')!,/script-src 'self'/);
    assert.equal(await root.text(),'<h1>HR Studio</h1>');assert.equal((await fetch(`${origin}/app.js`)).status,200);
    for(const path of ['/.env','/%2eenv','/server.cjs','/server.cjs.map','/server/store.ts','/src/App.tsx','/unknown']) {
      const result=await fetch(origin+path);assert.equal(result.status,404,path);assert.ok(!(await result.text()).includes('private'));
    }
  } finally {
    await new Promise<void>(resolve=>server.close(()=>resolve()));
    const target=resolve(directory);assert.equal(dirname(target),resolve(tmpdir()));assert.ok(basename(target).startsWith('hrstudio-client-test-'));rmSync(target,{recursive:true,force:true});
  }
});
