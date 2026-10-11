const fs=require('fs'),path=require('path');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(p=>p.isDirectory()?walk(path.join(dir,p.name)):[path.join(dir,p.name)])}
for(const file of walk('dist').filter(p=>p.endsWith('.html'))){let html=fs.readFileSync(file,'utf8');if(!html.includes('/languages.css'))continue;html=html.replace(/<link rel="stylesheet" href="\/store1.css">/g,'').replace('</head>','<link rel="stylesheet" href="/store1.css"></head>');const lang=(html.match(/<html lang="([^"]+)"/)||[])[1]||'en';
const skip={en:'Skip to content','zh-CN':'跳转到主要内容',es:'Saltar al contenido',fr:'Aller au contenu',de:'Zum Inhalt springen',ja:'本文へ移動',ko:'본문으로 이동',id:'Lewati ke konten'};
if(html.includes('id="app"')){html=html.replace(/<main id="app"[^>]*>/,'<main id="app" tabindex="-1">');if(!html.includes('class="skip-link"'))html=html.replace('<body>','<body><a class="skip-link" href="#app">'+skip[lang]+'</a>')}
html=html.replace(/<div class="review-bar">[\s\S]*?<\/div>/,'<div class="review-bar">QUICKMIND STORE1 · PRIVATE COMPARISON EDITION <a class="s1-review-link" href="/pages/design-review/">改版对比 / Design comparison ↗</a></div>');fs.writeFileSync(file,html)}
