// footprint-storydeck/deck — a deck folder made into one self-contained page, served for editing, and read back as
// text (Node). The parts the `storydeck` command uses (cli.js), for a script or a test of your own; the rest of the
// folder is how they are made, not a promise.
export {readConfig} from './config.js';
export {parseClicks} from './parse.js';
export {applyTransforms} from './transforms.js';
export {readDeck} from './source.js';
export {compileDeck} from './compile.js';
export {deckPage} from './page.js';
export {pageAssets} from './assets.js';
export {loadDeck, deckHtml, buildDeck} from './build.js';
export {outline, reviewClick} from './review.js';
export {checkDeck, formatProblems} from './check.js';
export {layoutCheck} from './layout.js';
export {serveDeck} from './dev.js';
export {initDeck} from './init.js';
export {serveMcp} from './mcp.js';
export {runCli} from './cli.js';
