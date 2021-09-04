require('dotenv').config();

//  The maximum amount of news in one post
const LIMIT = 3;

const moment = require('moment-timezone');

const axios = require('axios');

let Parser = require('rss-parser');
let parser = new Parser();

const { Telegraf } = require('telegraf');

//  Initialize the bot
const bot = new Telegraf(process.env.BOT_TOKEN);

//  All the rss feed that will be parsed
const rssFeeds = [
    "https://coinspot.io/feed/",
    "https://bits.media/rss2/",
    "https://ru.ihodl.com/feed/default/",
    "https://lorem-rss.herokuapp.com/feed"
];

let rssFeedsItems = {
    "https://coinspot.io/feed/": {
        buffer: []
    },
    "https://bits.media/rss2/": {
        buffer: []
    },
    "https://ru.ihodl.com/feed/default/": {
        buffer: []
    },
    "https://lorem-rss.herokuapp.com/feed": {
        buffer: []
    }
};

//  The default value for lastTimeUpdated is some time in the past
let lastTimeUpdated = new Date('2020-08-17T10:45:03.000Z');
var timeUpdated;

//  Functions that is responsible for sending built message to the Telegram Channel 
const sendMessage = (msg) => {
    try {
        let uri = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage?chat_id=${process.env.CHAT_ID}&text=${msg}`;
        uri = uri.toString().replace(/%/g,' процентов ');
        uri = decodeURI(uri);
        uri = encodeURI(uri);
        axios.get(uri);
    } catch (err) {
        console.log(err);
    }
}

//  Function that checks if the publish date of the news occured after the last update date
/*const compareDates = (date1, date2) => {
    if (moment(moment(date1).utc().format("YYYY-MM-DD HH:mm:ss")).isAfter(moment(date2))) {
        return true;
    } else {
        return false;
    }
}*/

//  Function that builds the message for the telegram post
const buildPost = (news, limit) => {
    let message = "";

    for (let i = 0; i < news.length; i++) {
        if (i == limit) {
            break;
        }

        if (news[i].title && news[i].link) {
            message = message + `${news[i].title}: \n${news[i].link} \n\n`;
        }
    }

    return message;
}

//  Function that parses the data from the rss feed
//  Then it returns only new posts
const parsing = async (url, limit) => {
    let items = [];
    items.length = 0;

    timeUpdated = moment.tz('Europe/Moscow');

    timeUpdated = timeUpdated.format("YYYY-MM-DD HH:mm:ss");

    //  Parsing the feed
    try {
        feed = await parser.parseURL(url);
        for (let i = 0; i < feed.items.length; i++) {

            //  Брать только нужные посты из RSS фида 
            if (i == limit) {
                break;
            }

            //  Определить есть ли в буфере текущий элемент
            //  Если элемента в буфере нет, то добавить элемент в items и записать в буфер 
            //  Так же следует сместить буфер, используя shift (очистить первый элемент массива буфера)
            let exist = rssFeedsItems[url].buffer.find(function(ele) {return ele.toString() === feed.items[i].pubDate.toString();});

            if (exist === undefined) {
                rssFeedsItems[url].buffer.push(feed.items[i].pubDate);
                if (rssFeedsItems[url].buffer.length == (limit * 2)) {
                    rssFeedsItems[url].buffer.shift();
                }

                items.push(feed.items[i]);
            } else {
                break;
            }
        }
    } catch (err) {
        console.log(err);
    }

    return items;
}

//  Function that parses the data from all the rss feeds
//  And then send separate messages to the Telegram channel
const updateAttempt = async (limit) => {
    let message = "";

    try {
        await Promise.all(rssFeeds.map(async (rssFeed) => {
            parsing(rssFeed, limit).then((news) => {
                if (news.length > 0) {
                    message = buildPost(news, limit);
                    if (message) { 
                        sendMessage(message);
                        lastTimeUpdated = timeUpdated;
                    }
                }
            });
        }));
    } catch (err) {
        console.log(err);
    }

    console.log("Last Time Updated: " + lastTimeUpdated);
}

const flagOn = true;

//  SetInterval that makes update attempts
interval = setInterval(async () => {
    await updateAttempt(LIMIT);

    if (!flagOn) {
        clearInterval(interval);
        }
    }, 60000
);

//  Launch the bot
bot.launch();
