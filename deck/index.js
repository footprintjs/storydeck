// footprint-storydeck/deck — a deck folder made into one self-contained page, served for editing, and read back as
// text (Node). The same parts the `storydeck` command uses (cli.js), for a script or a test of your own.
export {readConfig, DEFAULTS} from './config.js';
export {parseClicks, plainText, wordCount} from './parse.js';
export {wires, icons, readIcon, applyTransforms} from './transforms.js';
export {readDeck} from './source.js';
export {compileDeck} from './compile.js';
export {deckPage, themeRuntime} from './page.js';
export {pageAssets} from './assets.js';
export {loadDeck, deckHtml, buildDeck} from './build.js';
export {outline, reviewClick, findClick} from './review.js';
export {checkDeck, formatProblems} from './check.js';
export {layoutCheck, layoutProblems, findChromium} from './layout.js';
export {serveDeck} from './dev.js';
export {devClient} from './devClient.js';
export {initDeck, STARTER} from './init.js';
export {outlineTool, reviewTool, checkTool, buildTool} from './tools.js';
export {serveMcp, callTool, MCP_TOOLS} from './mcp.js';
export {runCli, parseArgs, USAGE} from './cli.js';
