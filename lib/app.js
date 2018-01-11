// --------------------------------------------------------------------------------------------------------------------
//
// Copyright (c) 2012-2013 AppsAttic Ltd - http://appsattic.com/
// Copyright (c) 2013 Andrew Chilton - http://chilts.org/
//
// --------------------------------------------------------------------------------------------------------------------

// core
var fs = require('fs')
var os = require('os')

// npm
var express = require('express')
var compress = require('compression')
var favicon = require('serve-favicon')
var morgan = require('morgan')
var bodyParser = require('body-parser')
var log2 = require('log2')
var connectBlog = require('connect-blog')
var moment = require('moment')
var zid = require('zid')

// local
var pkg = require('../package.json')
var stats = require('./stats.js')
var pages = require('./pages.js')
var headers = require('./headers.js')
var minify = require('./minify.js')

// --------------------------------------------------------------------------------------------------------------------
// application server

var isProd = process.env.NODE_ENV === 'production'
var libDir = '/var/lib/com-cssminifier'
var protocol = 'https'
var nakedDomain = 'cssminifier.com'
var baseUrl = protocol + '://' + nakedDomain

var app = express()
app.set('case sensitive routing', true)
app.set('strict routing', true)
app.set('views', __dirname + '/../views')
app.set('view engine', 'jade')
app.enable('trust proxy')

app.locals.pkg = pkg
app.locals.env = process.env.NODE_ENV
app.locals.min = isProd ? '.min' : ''
app.locals.pretty = isProd
app.locals.page = pages.page // all the language examples

// ignore some IP Addresses
var ignoreIPs = {
  '54.221.231.248' : true,
  '174.129.246.210' : true,
  '174.129.254.182' : true,
}
app.use(function(req, res, next) {
  if ( req.headers['x-forwarded-for'] in ignoreIPs ) {
    return res.send(420, "420 - Enhance Your Calm")
  }
  next()
})

// do all static routes first
app.use(compress())
app.use(favicon(__dirname + '/../public/favicon.ico'))

if ( isProd ) {
  var oneMonth = 30 * 24 * 60 * 60 * 1000
  app.use(express.static(__dirname + '/../public/', { maxAge : oneMonth }))
}
else {
  app.use(express.static(__dirname + '/../public/'))
}

app.use(morgan(isProd ? 'combined' : 'dev'))
app.use(bodyParser.urlencoded({
  extended : false,
  limit    : '1mb',
}))

// --------------------------------------------------------------------------------------------------------------------
// middleware

app.use(function(req, res, next) {
  res.locals.title  = false
  res.locals.post   = false
  res.locals.blog   = undefined
  res.locals.moment = moment

  // add the advert
  res.locals.ad = {
    title : 'Digital Ocean',
    url   : 'https://www.digitalocean.com/?refcode=c151de638f83',
    src   : '/s/img/digital-ocean-728x90.jpg',
    text1 : 'We recommend ',
    text2 : ' for hosting your sites. Free $10 credit when you sign up.',
  }

  // add the Request Id
  req._rid = Date.now() + '-' + zid(13)

  // add the logger
  req.log = log2({ id : req._rid, stream : process.stderr })

  next()
})

// --------------------------------------------------------------------------------------------------------------------
// Routes

function redirectToHome(req, res) {
  res.redirect('/')
}

app.get(
  '/',
  headers,
  function(req, res) {
    // req.log('/ : entry')
    stats.home.inc()
    res.render('index', { title : 'CSS Minifier' })
  }
)

app.get(
  '/compress',
  headers,
  function(req, res) {
    // req.log('/compress : entry')
    stats.compress.inc()
    res.render('compress', { title : 'CSS Compressor' })
  }
)

app.get('/minify', redirectToHome)
app.post(
  '/minify',
  function(req, res) {
    // req.log('/minify : entry')

    stats.minify.inc()

    minify(req._rid, req.body.input, function(err, styles) {
      if (err) return next(err)
      // render the same page whether we got an error or not
      res.render('index', { title : 'CSS Minifier', input : req.body.input, output : styles })
    })
  }
)

app.get('/download', redirectToHome)
app.post(
  '/download',
  function(req, res, next) {
    // req.log('/download : entry')

    stats.download.inc()

    minify(req._rid, req.body.input, function(err, styles) {
      if (err) return next(err)
      res.header('Content-Disposition', 'attachment; filename=styles.css')
      res.header('Content-Type', 'text/plain')
      res.end(styles)
    })
  }
)

app.get(  '/raw',      redirectToHome )
app.post(
  '/raw',
  function(req, res, next) {
    // req.log('/raw : entry')

    // only count the stat and minimise if the length is non-zero
    var minimised
    if ( req.body && req.body.input && req.body.input.length ) {
      stats.raw.inc()

      minify(req._rid, req.body.input, function(err, styles) {
        if (err) return next(err)
        res.header('Content-Type', 'text/plain')
        res.end(styles)
      })
    }
    else {
      res.header('Content-Type', 'text/plain')
      res.end('')
    }
  }
)

pages.routes(app)

app.get(
  '/plugins',
  headers,
  function(req, res) {
    // req.log('/plugins : entry')
    res.render('plugins', { title : 'Editor Plugins which use CSS Minifier' })
  }
)

app.get(
  '/programs',
  headers,
  function(req, res) {
    // req.log('/programs : entry')
    res.render('programs', { title : 'Programs which use CSS Minifier' })
  }
)

app.get(
  '/stats',
  function(req, res, next) {
    var finished = false
    var got = 0
    var currentStats = {}

    // get some bits
    stats.pages.forEach(function(hitName) {
      stats[hitName].values(function(err, data) {
        if ( finished ) return
        if (err) {
          finished = true
          return next(err)
        }

        got += 1

        // save this hit
        data.forEach(function(hit) {
          currentStats[hit.ts] = currentStats[hit.ts] || {}
          currentStats[hit.ts][hitName] = hit.val
        })

        // if we've got all the results, render the page
        if ( got === stats.pages.length ) {
          finished = true
          res.render('stats', { stats : currentStats, title : 'stats' })
        }
      })
    })
  }
)

// blog
var blog = connectBlog({
  title       : 'CSS Minifier Blog',
  description : 'Online CSS Minifier/Compressor. Free! Works with Media Queries. Provides an API. Simple Quick and Fast!.',
  contentDir  : __dirname + '/../blog',
  domain      : nakedDomain,
  base        : '/blog',
})

app.get(
  '/blog',
  function(req, res) {
    res.redirect('/blog/')
  }
)

app.get(
  '/blog/',
  blog
)

app.get(
  '/blog/:path',
  blog
)

// create the sitemap with the blog posts too
var sitemap = [
  baseUrl + '/',
  baseUrl + '/plugins',
  baseUrl + '/programs',
  baseUrl + '/blog/',
]
pages.pages.forEach(function(pageName) {
  sitemap.push(baseUrl + '/' + pageName)
})
blog.posts.forEach(function(post) {
  sitemap.push(baseUrl + '/blog/' + post.name)
})
var sitemapTxt = sitemap.join('\n') + '\n'

app.get(
  '/sitemap.txt',
  function(req, res) {
    res.setHeader('Content-Type', 'text/plain')
    res.send(sitemapTxt)
  }
)

app.get(
  '/uptime',
  function(req, res) {
    res.setHeader('Content-Type', 'text/plain')
    res.send('' + parseInt(process.uptime(), 10))
  }
)

// these links were shown as being linked to in Google Webmasters, but are 404's, so redirect to the homepage
app.get('/,', redirectToHome)

// --------------------------------------------------------------------------------------------------------------------
// export the app

module.exports = app

// --------------------------------------------------------------------------------------------------------------------
