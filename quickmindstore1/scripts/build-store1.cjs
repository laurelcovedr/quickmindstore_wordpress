const {execFileSync}=require('node:child_process');
for(const script of ['build-seo.cjs','build-languages.cjs','finish-store1.cjs'])execFileSync(process.execPath,['scripts/'+script],{stdio:'inherit'});
execFileSync('python3',['scripts/optimize-seo-geo.py'],{stdio:'inherit'});
