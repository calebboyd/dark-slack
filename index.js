#!/usr/bin/env node
const 
  path = require('path'),
  fs = require('fs'),
  isWin = process.platform === 'win32' ? true : false,
  isMac = process.platform === 'darwin',
  resourcePaths = [],
  patchedPaths = [],
  cssPath = path.join(__dirname, './installed.css'),
  patch =     `
//dark-slack-patch-start
document.addEventListener('DOMContentLoaded', function() {
  const fs = require('fs'),
    cssPath = ${JSON.stringify(path.normalize(cssPath))},
    css = fs.readFileSync(cssPath, 'utf-8')
  $("<style></style>").appendTo('head').html(css)
});
//dark-slack-patch-end`,
  //Themes and updating
  mapping = {
    [null]: "black.css",
    [undefined]: "black.css",
    '': "black.css",
    b: "black.css",
    o: "og",
    og: "og",
    ad: "arc-dark",
    am: "aubergine-monospaced",
    a: "aubergine",
    bm: "black-monospaced",
    mbm: "midnight-blue-monospaced",
    mb: "midnight-blue",
    sd: "solarized-dark",
    sl: "solarized-light",
    "arc-dark": "variants/arc-dark.css",
    "aubergine-monospaced": "variants/aubergine-monospaced.css",
    "aubergine": "variants/aubergine.css",
    "black-monospaced": "variants/black-monospaced.css",
    "midnight-blue-monospaced": "variants/midnight-blue-monospaced.css",
    "midnight-blue": "variants/midnight-blue.css",
    "solarized-dark": "variants/solarized-dark.css",
    "solarized-light": "variants/solarized-light.css",
    "black": "black.css",
    "variants/arc-dark.css": "variants/arc-dark.css",
    "variants/aubergine-monospaced.css": "variants/aubergine-monospaced.css",
    "variants/aubergine.css": "variants/aubergine.css",
    "variants/black-monospaced.css": "variants/black-monospaced.css",
    "variants/midnight-blue-monospaced.css": "variants/midnight-blue-monospaced.css",
    "variants/midnight-blue.css": "variants/midnight-blue.css",
    "variants/solarized-dark.css": "variants/solarized-dark.css",
    "variants/solarized-light.css": "variants/solarized-light.css",
    "black.css": "black.css"
  },
  color = mapping[mapping[mapping[process.argv[2]]]],
  help = `Usage: dark-slack [theme=b] [options]

  Options:
    -i --install    fetch the latest css from laCour/slack-night-mode 
                       NOTE: please be weary of installing remote CSS

  Themes (alias   name):
    o    original
    b    black
    ad   arc-dark
    am   aubergine-monospaced
    a    aubergine
    bm   black-monospaced
    mbm  midnight-blue-monospaced
    mb   midnight-blue
    sd   solarized-dark
    sl   solarized-light`

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(help)
  process.exit(0)
}

if (isWin) {
  const appPath = path.join(process.env.LOCALAPPDATA, 'slack')
  resourcePaths.push(...fs.readdirSync(appPath).sort().filter(x => {
    return x.startsWith('app-') && fs.statSync(path.join(appPath, x)).isDirectory()
  }).map(x => {
    return path.join(appPath, x, 'resources/app.asar.unpacked/src/static/ssb-interop.js')
  }))
} else if (isMac) {
  resourcePaths.push('/Applications/Slack.app/Contents/Resources/app.asar.unpacked/src/static/ssb-interop.js')
}

resourcePaths.forEach(x => {
  let contents = fs.readFileSync(x, 'utf-8')
  const matches = contents.match(/\/\/dark-slack-patch-(start|end)/g)
  const hasPatch = contents.includes(patch)
  if (!hasPatch && color !== 'og') {
    fs.appendFileSync(x, patch)
    patchedPaths.push(x)
  }
  if (color === 'og' && matches) {
    let lastIndex = 0
    matches.forEach((x, i) => {      
      const index = contents.indexOf(x)
      const isEnd = Boolean(i % 2)
      if (isEnd) {
        contents = contents.substr(0, lastIndex -1) + contents.substr(index + 23);
      }
      lastIndex = index
    })
    fs.writeFileSync(x, contents)
  }
}) 

if (!patchedPaths.length) {
  if (color === 'og') {
    console.log('Removed patches')
  } else {
    console.log(`Already patched`)
  }
} else {
  console.log('Patched: ' + cssPath + '\nto: ' + JSON.stringify(patchedPaths, null, 2))
}

const updateUrl = 'https://raw.githubusercontent.com/laCour/slack-night-mode/master/css/raw/' + color
const colorPath = cssPath + color.replace(/\//g, '-')
let cssContents = ''

if (color === 'black.css' && !fileExists(colorPath)) {
  fs.writeFileSync(colorPath, fs.readFileSync(cssPath))
}

if (color !== 'og') {
  fetchCss()
  .catch((e) => {
    console.log('Error fetching theme from: ' + updateUrl + '\n' + e)
  })
  .then((cssContents) => {
    if (process.argv.includes('--install') || process.argv.includes('-i')) {
      fs.writeFileSync(colorPath, cssContents)
      console.log('Installed latest "' + color + '" theme')
    }
    if (fileExists(colorPath)) {
      const existingContents = fs.readFileSync(colorPath, 'utf-8')
      if (existingContents !== cssContents) {
        console.log('Updated styles available from: ' + updateUrl)
        console.log('Run with `--install` to update the theme')
      }
      fs.writeFileSync(cssPath, fs.readFileSync(colorPath))
      console.log('Applied the installed "' + color + '" theme')
    } else {
      console.log('Theme not installed\nTo download the css run with --install')
    }
  })
}

function fileExists(file) {
  try {
    fs.readFileSync(file)
    return true
  } catch (e) {
    return false
  }
}

function fetchCss () {
  const https = require('https')
  return new Promise((resolve, reject) => {
    const req = https.request(updateUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'dark-slack'
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(res.statusMessage)
      }
      let css = ''
      res.on('data', (chunk) => {
        css += chunk
      })
      res.on('close', () => {
        resolve(css)
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}