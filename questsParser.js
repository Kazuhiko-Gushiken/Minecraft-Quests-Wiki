const escapeHtml = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

const defaultMinecraftColors = "&0=#000000;&1=#0000AA;&2=#00AA00;&3=#00AAAA;&4=#AA0000;&5=#AA00AA;&6=#FFAA00;&7=#AAAAAA;&8=#555555;&9=#5555FF;&a=#55FF55;&b=#55FFFF;&c=#FF5555;&d=#FF55FF;&e=#FFFF55;&f=#FFFFFF;&u=#6E8896"
const defaultColor = '#FFFFFF'

const colorMap = parseColorMap(
        defaultMinecraftColors
    );

function parseColorMap(input){
    const map = new Map();
    if(!input) return map;
    input.split(';').forEach(entry=>{
        const m=entry.trim().match(/^&?([^\s=;]+)\s*=\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|[A-Za-z]+)$/u); // old regex    /^&?([A-Za-z0-9]+)\s*=\s*([^;]+)$/
    if(m) map.set(m[1].toLowerCase(),m[2]); // .trim()
    });
    return map;
}

export function markdownToHtml(text) {

    text = preprocess(text);

    return toHtmlRuns(text, {
        colorMap,
        defaultColor
    });
}

export function formatRawHtml(text) {
    text = preprocess(text);
    
    return toHtmlRuns(text, {
        colorMap,
        defaultColor: null
    });
}

function preprocess(text) {
    text = smartQuotes(text);
    return text;
}

function parseRuns(src, {colorMap, defaultColor}) {
    let st={bold:false,italic:false,underline:false,strike:false,color:defaultColor};
    let buf='';
    const runs=[];
    const styleTags=new Set(['l','o','m','n','r']);
    function flush() {
        if (!buf) return;

        runs.push({
            text: buf,
            color: st.color,
            bold: st.bold,
            italic: st.italic,
            underline: st.underline,
            strike: st.strike
        });

        buf = '';
    }

    const customKeys=[...colorMap.keys()].sort((a,b)=>b.length-a.length);
    for(let i=0;i<src.length;i++){
        const ch=src[i];

        if(ch === '.' && src[i+1] === '.' && src[i+2] === '.' && src[i+3] !== '.' && src[i-1] !== '.'){
            buf += '\u2026';
            i += 2;
            continue;
        }

        if(ch === '\\' && src[i+1] === '-'){
            buf += '\u2011';
            i++;
            continue;
        }

        if(ch === '\\' && src[i+1] === '_'){
            buf += '\u00A0';
            i++;
            continue;
        }

        if(ch !== '&') {
            buf += ch;

            if (ch === '\n'){
                flush();
                st = {
                    bold:false,
                    italic:false,
                    underline:false,
                    strike:false,
                    color:defaultColor
                };
            }

            continue;
        }
        const nxt=src[i+1];
        if(nxt==='&'){ buf+='&'; i++; continue; }
        if(!nxt){ buf+='&'; continue; }
        if(nxt==="#"){
            const rest=src.slice(i+2);
            const m=rest.match(/^([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
            if(m){
                flush(); st.color='#'+m[1];
                i+=1+m[1].length;
                continue;
            }
            buf+='&#'; i+=1; continue;
        }
        const rest=src.slice(i+1);
        let matchedKey='';
        for(const k of customKeys) {
            if(k && rest.toLowerCase().startsWith(k)) {
                matchedKey=k; break;
            }
        }
        if(matchedKey) {
            flush(); st.color=colorMap.get(matchedKey); i+=matchedKey.length; continue;
        }
        const first=rest[0];
        const k=first ? first.toLowerCase() : '';
        if(styleTags.has(k)){
            flush();
            if(k==='r') st={bold:false,italic:false,underline:false,strike:false,color:defaultColor};
            else if(k==='l') st.bold=true;
            else if(k==='o') st.italic=true;
            else if(k==='m') st.strike=true;
            else if(k==='n') st.underline=true;
            i+=1; continue;
        }
        buf+='&'+first; i+=1;
    }

    flush();
    return runs;
}

function toHtmlRuns(src, options){
    const runs = parseRuns(src, options);

    return runs.map(run => {
        const content=escapeHtml(run.text).replace(/\n/g,'<br>');
        const style = buildStyleString(run);
        return style ? `<span style="${style}">${content}</span>` : content;

    }).join('');
}

export function formatRawCanvas(text) {
    text = preprocess(text);
    return parseRuns(text, {
        colorMap,
        defaultColor: null
    });
}

function buildStyleString(st){
    const parts=[];
    if(st.color) parts.push(`color:${st.color}`);
    if(st.bold) parts.push('font-weight:bold');
    if(st.italic) parts.push('font-style:italic');
    const deco=[];
    if(st.underline) deco.push('underline');
    if(st.strike) deco.push('line-through');
    if(deco.length) parts.push(`text-decoration:${deco.join(' ')}`);
    return parts.join(';');
}



function buildVisibleText(text) {
    let visible = '';
    let map = [];

    for(let i = 0; i < text.length; i++) {

        if(
            text[i] === '&' &&
            text[i + 1] === '&'
        ) {
            visible += '&';
            map.push(i);

            i++;
            continue;
        }

        if(
            text[i] === '&' &&
            i + 1 < text.length &&
            text[i + 1] !== '&'
        ) {
            i++;
            continue;
        }

        if(
            text[i] === '\\' &&
            text[i + 1] === '-'
        ) {
            visible += '\u2011';
            map.push(i);

            i++;
            continue;
        }

        if(
            text[i] === '\\' &&
            text[i + 1] === '_'
        ) {
            visible += '\u00A0';
            map.push(i);

            i++;
            continue;
        }

        if(
            text[i] === '\\' &&
            text[i + 1] === "'"
        ) {
            visible += '\uE000';
            map.push(i);

            i++;
            continue;
        }

        visible += text[i];
        map.push(i);
    }

    return {visible, map};
}

function isWordChar(ch) {
    return /[A-Za-z0-9]/.test(ch ?? '');
}

function isBoundary(ch) {
    return /[\s.,!?;:)\]}]/.test(ch ?? '');
}

function getLineNumber(text, index) {
    return text.slice(0, index).split('\n').length;
}

function smartQuotes(text) {

    text = text.replaceAll("\\'", "\uE000");

    const {visible, map} = buildVisibleText(text);

    /*
    console.log(visible);
    console.log("=====================");
    console.log(map);
    */

    const replacements = [];
    const unresolved = [];

    let openDouble = true;
    let openSingle = true;

    let lastDoubleOpen = null;
    let lastSingleOpen = null;

    for (let i = 0; i < visible.length; i++) {
        const ch = visible[i];

        const prev = visible[i - 1] ?? null;
        const next = visible[i + 1] ?? null;


        if (ch === '\n') {
            if (!openDouble) {
                unresolved.push({
                    error: 'Unclosed double quote',
                    originalIndex: lastDoubleOpen
                });

                openDouble = true;
                lastDoubleOpen = null;
            }

            if (!openSingle) {
                unresolved.push({
                    error: 'Unclosed single quote',
                    originalIndex: lastSingleOpen
                });

                openSingle = true;
                lastSingleOpen = null;
            }

            continue;
        }

        if(
            ch === "'" &&
            /[A-Za-z]/.test(prev ?? '') &&
            /[A-Za-z]/.test(next ?? '')
        ) {
            replacements.push({
                index: map[i],
                value: '\u2019'
            });
            continue;
        }

        if (ch === '"' && openDouble) {
            lastDoubleOpen = map[i];
            
            replacements.push({
                index: map[i],
                value: '\u201C'
            });

            openDouble = false;

            continue;
        }

        if (ch === '"' && !openDouble) {
            replacements.push({
                index: map[i],
                value: '\u201D'
            });

            lastDoubleOpen = null;
            openDouble = true;

            continue;
        }

        if (ch === "'" && openSingle) {
            lastSingleOpen = map[i];

            replacements.push({
                index: map[i],
                value: '\u2018'
            })

            openSingle = false;

            continue;
        }

        if (ch === "'" && !openSingle) {
            replacements.push({
                index: map[i],
                value: '\u2019'
            })

            lastSingleOpen = null;

            openSingle = true;
            continue;
        }

    }

    let chars = [...text];

    for (const replacement of replacements) {
        chars[replacement.index] = replacement.value;
    }

    text = chars.join('');

    text = text.replaceAll(
        '\uE000',
        '\u2019'
    );

    for (let i = 0; i < text.length; i++) {

        if (
            text[i] === "'" ||
            text[i] === '"'
        ) {
            unresolved.push({
                textIndex: i,

            });
            continue;
        }
    }

    if (!openDouble) {
        unresolved.push({
            error: 'Unclosed double quote',
            origianlIndex: lastDoubleOpen
        });
    }

    if (!openSingle) {
        unresolved.push({
            error: 'Unclosed single quote',
            originalIndex: lastSingleOpen
        });
    }

    if (unresolved.length > 0) {
        for (const item of unresolved){
            if (item.originalIndex != null) {
                alert(
                    `${item.error}\nLine ${getLineNumber(text, item.originalIndex)}`
                );
            }
        }
        console.warn(unresolved);
    }
    return text;
}