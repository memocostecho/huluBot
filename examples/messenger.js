'use strict';

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
//var firebase = require("firebase");

let Wit = null;
let log = null;
try {
  // if running from repo
  Wit = require('../').Wit;
  log = require('../').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}

/*firebase.initializeApp({
  serviceAccount: "/Users/guillermo.rosales/wit/node-wit/examples/devcircles-958a5a12a499.json",
  databaseURL: "https://dev-circles.firebaseio.com"
});*/

//var db = firebase.database();
//var ref = db.ref("/some_resource");

var recipientIdGlobal;
// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = process.env.WIT_TOKEN;

// Messenger API parameters
const FB_PAGE_ID = process.env.FB_PAGE_ID;
if (!FB_PAGE_ID) { throw new Error('missing FB_PAGE_ID') }
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) { throw new Error('missing FB_PAGE_TOKEN') }
const FB_APP_SECRET = process.env.FB_APP_SECRET;
if (!FB_APP_SECRET) { throw new Error('missing FB_APP_SECRET') }

let FB_VERIFY_TOKEN = "holaMemo";
crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = buff.toString('hex');
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  var body ={};
  if(text.attachment!=undefined){
      body = JSON.stringify({
      recipient: { id },
      message: text ,
    });
  }else{
    body = JSON.stringify({
    recipient: { id },
    message: {text} ,
  });
  }
  console.log("enviando algo a "+id)
  console.log("BODY: "+body)
  const qs = 'access_token=' + encodeURIComponent(FB_PAGE_TOKEN);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  recipientIdGlobal = fbid;
  return sessionId;
};

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

// Our bot actions
const actions = {
  send({sessionId}, {text}) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      return fbMessage(recipientId, text)
      .then(() => null)
      .catch((err) => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
        );
      });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },getForecast({context, entities}) {
    return new Promise(function(resolve, reject) {
      var location = firstEntityValue(entities, 'location')
      if (location) {

        var forecastApi = "http://api.openweathermap.org/data/2.5/weather?q="+location+"&appid=b08af3eb64583fdc80eefb9db32d8929"

        request(forecastApi, function(error, response, body) {
          //console.log(response);
          var JSONResponse = JSON.parse(body)
          console.log("RESPONSE:" + JSONResponse.weather[0].description);
          context.forecast = JSONResponse.weather[0].description +" in "+location//response.weather[0].description; // we should call a weather API here
          return resolve(context);
        });
        //context.forecast = "Consulting in "+ location
        delete context.missingLocation;
      } else {
        context.missingLocation = true;
        delete context.forecast;
        return resolve(context);
      }
    });
  },getCircles({context, entities}) {
    return new Promise(function(resolve, reject) {
      console.log(("CONTEXT: " + context))
      context.circles = "test";
      var template = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Mexico",
            subtitle: "Dev circle Ciudad de Mexico",
            item_url: "https://www.facebook.com/groups/DevCCiudaddeMexico/?fref=ts",
            image_url: "http://1.bp.blogspot.com/-Sd1OnZ4ceTw/Vdd_wlO7NYI/AAAAAAAAL7Q/moxbVS8rLGc/s1600/x29.jpg",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Subscribe"
            }, {
              type: "postback",
              title: "More info",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "Manila",
            subtitle: "Dev circle Manila",
            item_url: "https://www.oculus.com/en-us/touch/",
            image_url: "https://scontent.fsnc1-1.fna.fbcdn.net/v/t1.0-9/13516301_10101079257635851_5071947382654109237_n.png?oh=4fbcf44c5bc0718ca6b24b59e51f7fda&oe=58324EE3",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
  };
  return fbMessage(recipientIdGlobal, template)
  .then(() => null)
  //return resolve(context);
    });
  },play({context, entities}) {
    return new Promise(function(resolve, reject) {
      console.log(("CONTEXT: " + context))
      context.show_movie = "test";
      var show_movie = firstEntityValue(entities, 'show_movie')
      console.log(("show_movie: " + show_movie))
      if( show_movie == "terminator") {

      var template = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Terminator Genisys",
            subtitle: "(2015)",
            item_url: "http://www.hulu.com/watch-mobile/958003",
            image_url: "http://images.techtimes.com/data/images/full/253926/hulu-july-2016-the-complete-list-of-movies-and-tv-shows-available-to-stream.png",
            buttons: [{
              type: "web_url",
              url: "http://www.hulu.com/watch-mobile/958003",
              title: "Watch"
            }, {
              type: "postback",
              title: "Rate this movie",
              payload: "Rating this movie",
            }],
          }]
        }
      }
  };
}else{


  var template = {
  attachment: {
    type: "template",
    payload: {
      template_type: "generic",
      elements: [{
        title: "Family guy",
        subtitle: "(2010)",
        item_url: "http://www.hulu.com/watch-mobile/7161",
        image_url: "http://ib1.huluim.com/show_key_art/54?size=1600x600&region=US",
        buttons: [{
          type: "web_url",
          url: "http://www.hulu.com/watch-mobile/958003",
          title: "Watch"
        }, {
          type: "postback",
          title: "Rate this show",
          payload: "Rating this show",
        }],
      }]
    }
  }
};



}
  return fbMessage(recipientIdGlobal, template)
  .then(() => null)
    });
  },help({context, entities}) {
    return new Promise(function(resolve, reject) {

      context.helptext = "1. Recommend you a movie or show \n -Recommend me a movie/show \n 2.  Play a movie or show for you \n -Play Adeline \n -Play The path \n -Open app \n 3.  Helping you deciding your plan \n 4.  Listen to you if you have any issue with the product/account"
      return resolve(context);

    });
  },recommend({context, entities}) {
    return new Promise(function(resolve, reject) {
      console.log(("CONTEXT: " + context))
      context.circles = "test";
      var template = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "Adeline",
            subtitle: "(2015)",
            item_url: "hulu://videos/786878",
            image_url: "http://ib4.huluim.com/movie/60709591?size=220x318&region=us&fallback_to_the_invisible=1&region=us",
            buttons: [{
              type: "web_url",
              url: "hulu://videos/786878",
              title: "Watch"
            }, {
              type: "postback",
              title: "Rate this movie",
              payload: "Rate this movie",
            }],
          }, {
            title: "The republic of love",
            subtitle: "(2003)",
            item_url: "http://www.hulu.com/videos/104578",
            image_url: "http://ib4.huluim.com/movie/50010223?size=220x318&region=us&fallback_to_the_invisible=1&region=us",
            buttons: [{
              type: "web_url",
              url: "http://www.hulu.com/videos/104578",
              title: "Watch"
            }, {
              type: "postback",
              title: "Rate this movie",
              payload: "Payload for second bubble",
            }]
          }, {
            title: "The Lovers",
            subtitle: "(1958)",
            item_url: "http://www.hulu.com/watch-mobile/254698",
            image_url: "http://ib3.huluim.com/movie/40008318?size=220x318&region=us&fallback_to_the_invisible=1&region=us",
            buttons: [{
              type: "web_url",
              url: "http://www.hulu.com/watch-mobile/254698",
              title: "Watch"
            }, {
              type: "postback",
              title: "Rate this movie",
              payload: "Payload for second bubble",
            }]
          }

        ]
        }
      }
  };
  return fbMessage(recipientIdGlobal, template)
  .then(() => null)
  //return resolve(context);
    });
  }

  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart
};

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const {text, attachments} = event.message;

          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(sender, 'Sorry I can only process text messages for now.')
            .catch(console.error);
          } else if (text) {
            // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
              sessionId, // the user's current session
              text, // the user's message
              sessions[sessionId].context // the user's current session state
            ).then((context) => {
              // Our bot did everything it has to do.
              // Now it's waiting for further messages to proceed.
              console.log('Waiting for next user messages');

              // Based on the session state, you might want to reset the session.
              // This depends heavily on the business logic of your bot.
              // Example:
              // if (context['done']) {
              //   delete sessions[sessionId];
              // }

              // Updating the user's current session state
              sessions[sessionId].context = context;
            })
            .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
          }
        } else {
          console.log('received event', JSON.stringify(event));
        }
      });
    });
  }
  res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', FB_APP_SECRET)
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}


app.listen(PORT);
console.log('Listening on :' + PORT + '...');
