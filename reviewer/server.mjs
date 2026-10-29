import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url));
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
const server=http.createServer((req,res)=>{
  const requestPath=req.url==="/"?"/index.html":decodeURIComponent(req.url.split("?")[0]);
  const file=path.resolve(root,`.${requestPath}`);
  if(!file.startsWith(root)){res.writeHead(403);return res.end("Forbidden");}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end("Not found");}res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream","Cache-Control":"no-store"});res.end(data);});
});
const port=Number(process.env.PORT||4173);
server.listen(port,"127.0.0.1",()=>console.log(`Voice reviewer running at http://127.0.0.1:${port}`));
