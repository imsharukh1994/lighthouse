/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Author: Sharukh
 * GitHub: https://github.com/imsharukh1994
 * Date: December 19, 2024
 * Description: This script builds and optionally deploys the viewer app to GitHub Pages.
 */

import { createRequire } from 'module';
import esbuild from 'esbuild';
import * as plugins from './esbuild-plugins.js';
import { GhPagesApp } from './gh-pages-app.js';
import { LH_ROOT } from '../shared/root.js';
import path from 'path';

const require = createRequire(import.meta.url);

const REPORT_GENERATOR_PATH = 'report/generator/report-generator.js';
const STYLESHEET_PATH = 'flow-report/assets/styles.css';
const LOCALIZATION_PATH = 'shared/localization/locales/*.json';
const MAIN_JS_PATH = 'src/main.js';
const PAKO_INFLATE_PATH = 'pako/dist/pako_inflate.js';

const DEBUG = process.env.DEBUG === 'true'; // Adjust for clearer handling of debug environment variable

// Function to build the report generator, including plugins and error handling
async function buildReportGenerator() {
  try {
    const result = await esbuild.build({
      entryPoints: [REPORT_GENERATOR_PATH],
      write: false,
      bundle: true,
      minify: !DEBUG,
      plugins: [
        plugins.umd('ReportGenerator'),
        plugins.replaceModules({
          [`${LH_ROOT}/report/generator/flow-report-assets.js`]: 'export const flowReportAssets = {}',
        }),
        plugins.ignoreBuiltins(),
        plugins.bulkLoader([
          plugins.partialLoaders.inlineFs({ verbose: Boolean(DEBUG) }),
          plugins.partialLoaders.rmGetModuleDirectory,
        ]),
      ],
    });

    return result.outputFiles[0].textUmd;
  } catch (err) {
    console.error('Error during build process:', err);
    process.exit(1); // Exit with error code
  }
}

// Main function to build viewer and optionally deploy to GitHub Pages
async function main() {
  const reportGeneratorJs = await buildReportGenerator();

  const app = new GhPagesApp({
    name: 'viewer',
    appDir: path.resolve(LH_ROOT, 'viewer/app'),
    html: { path: 'index.html' },
    stylesheets: [
      { path: path.resolve(LH_ROOT, STYLESHEET_PATH) },
      { path: path.resolve(LH_ROOT, STYLESHEET_PATH) }, // Assuming this is the same stylesheet repeated
    ],
    javascripts: [
      reportGeneratorJs,
      { path: require.resolve(PAKO_INFLATE_PATH) },
      {
        path: MAIN_JS_PATH,
        esbuild: true,
        esbuildPlugins: [
          plugins.replaceModules({
            [`${LH_ROOT}/shared/localization/locales.js`]: 'export const locales = {};',
          }),
          plugins.ignoreBuiltins(),
          plugins.bulkLoader([
            plugins.partialLoaders.inlineFs({ verbose: Boolean(DEBUG) }),
            plugins.partialLoaders.rmGetModuleDirectory,
          ]),
        ],
      },
    ],
    assets: [
      { path: 'images/**/*', destDir: 'images' },
      { path: 'manifest.json' },
      { path: path.resolve(LH_ROOT, LOCALIZATION_PATH), destDir: 'locales' },
    ],
  });

  try {
    await app.build();

    const argv = process.argv.slice(2);

    if (argv.includes('--deploy')) {
      await app.deploy();
    }
  } catch (err) {
    console.error('Error during deployment process:', err);
    process.exit(1); // Exit with error code
  }
}

// Run the main function
await main();


