const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const puppeteer = require(resolve(__dirname, '../../../../../node_modules/puppeteer-core'));
// Capture the textarea supplied to the browser copy command by the real UI handler.
// The connected browser's virtual clipboard cannot read these writes.
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page = await browser.newPage();
    await page.setViewport({width:1440,height:1000});
    await page.evaluateOnNewDocument(() => {
      window.__copyBoundary = [];
      const original = document.execCommand.bind(document);
      document.execCommand = (command, ...args) => {
        if (command === 'copy') {
          const target = document.activeElement;
          window.__copyBoundary.push(target && 'value' in target ? target.value : window.getSelection()?.toString() || '');
          return true;
        }
        return original(command, ...args);
      };
    });
    await page.goto('http://127.0.0.1:3018/#/tmp/dope-c12-p4-qual',{waitUntil:'networkidle2',timeout:30000});
    const chatButton='[aria-label="Open Chat Thinking"]';
    await page.mouse.click(24,212);
    await page.waitForSelector(chatButton,{timeout:30000,visible:true});
    await page.click(chatButton);
    await page.waitForSelector('[aria-label="Copy Response"]',{timeout:10000});
    const copies=()=>page.evaluate(()=>window.__copyBoundary.slice());
    const response=await page.$$('[aria-label="Copy Response"]');
    await response[0].click();
    let recorded=await copies();
    assert.equal(recorded.at(-1),'1 + 1 = 2');
    const cleanResponse=recorded.at(-1);
    const transcript='[aria-label="Copy whole transcript"]';
    await page.click(transcript);
    recorded=await copies();
    const cleanTranscript=recorded.at(-1);
    assert.ok(cleanTranscript.indexOf('What is 1 + 1?')<cleanTranscript.indexOf('1 + 1 = 2'));
    assert.doesNotMatch(cleanTranscript,/\[Reasoning\]|\[Provisional output\]|\[Tool:|No final response/);
    await response[0].click({button:'right'});
    await page.waitForSelector('.dope-chat-copy-menu [role="menuitem"]');
    assert.equal(await page.$eval('.dope-chat-copy-menu [role="menuitem"]',e=>e.textContent),'Copy with Reasoning');
    await page.click('.dope-chat-copy-menu [role="menuitem"]');
    recorded=await copies();
    const diagnosticResponse=recorded.at(-1);
    assert.match(diagnosticResponse,/\[Reasoning\]/);
    assert.match(diagnosticResponse,/Final response:\n1 \+ 1 = 2/);
    assert.doesNotMatch(diagnosticResponse,/src\/counter\.js|\[Tool:|api_key=/);
    await page.click(transcript,{button:'right'});
    await page.waitForSelector('.dope-chat-copy-menu [role="menuitem"]');
    await page.click('.dope-chat-copy-menu [role="menuitem"]');
    recorded=await copies();
    const diagnosticTranscript=recorded.at(-1);
    assert.ok(diagnosticTranscript.indexOf('What is 1 + 1?')<diagnosticTranscript.indexOf('Final response:\n1 + 1 = 2'));
    assert.match(diagnosticTranscript,/\[Reasoning\]/);
    assert.match(diagnosticTranscript,/cancelled\]:[\s\S]*?No final response/);
    assert.match(diagnosticTranscript,/\[Tool: read_file: completed\]/);
    assert.doesNotMatch(diagnosticTranscript,/\[Tool: [^\]]*\{[^\]]*\}|api_key=/);
    await response[0].focus();
    await page.keyboard.down('Shift'); await page.keyboard.press('F10'); await page.keyboard.up('Shift');
    await page.waitForSelector('.dope-chat-copy-menu [role="menuitem"]');
    await page.keyboard.press('Escape');
    assert.equal(await page.$('.dope-chat-copy-menu [role="menuitem"]'),null);
    assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('dope-chat-copy-response')),true);
    const firstContent = await page.$('.dope-chat-message-assistant .dope-chat-message-content');
    await firstContent.hover();
    const contentBox = await firstContent.boundingBox();
    await page.mouse.move(contentBox.x+5,contentBox.y+contentBox.height/2);
    await page.mouse.down();
    await page.mouse.move(contentBox.x+75,contentBox.y+contentBox.height/2,{steps:6});
    await page.mouse.up();
    const selectedText = await page.evaluate(()=>window.getSelection()?.toString() || '');
    assert.ok(selectedText.length > 0,'Chat text remains selectable');
    await page.mouse.click(contentBox.x+5,contentBox.y+contentBox.height/2);
    const region = await page.$('.dope-chat-scroll');
    const regionBox = await region.boundingBox();
    const beforeScroll = await page.$eval('.dope-chat-scroll',element=>element.scrollTop);
    await page.keyboard.down('Space');
    await page.mouse.move(regionBox.x+regionBox.width/2,regionBox.y+regionBox.height*0.7);
    await page.mouse.down();
    await page.mouse.move(regionBox.x+regionBox.width/2,regionBox.y+regionBox.height*0.3,{steps:8});
    await page.mouse.up();
    await page.keyboard.up('Space');
    const afterScroll = await page.$eval('.dope-chat-scroll',element=>element.scrollTop);
    assert.ok(afterScroll > beforeScroll,'Space drag still scrolls Chat');
    console.log(JSON.stringify({result:'PASS',copyCount:recorded.length,cleanResponse,cleanTranscriptBytes:cleanTranscript.length,diagnosticResponseBytes:diagnosticResponse.length,diagnosticTranscriptBytes:diagnosticTranscript.length,rightClick:true,shiftF10:true,escape:true,focusRestored:true,textSelection:true,spaceDrag:true}));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
