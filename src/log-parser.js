import fs from 'fs';
import es from 'event-stream';
import ua from 'useragent';

class LogStreamReader {
  streamCallback = null;
  logsList = null;

  constructor({
    onLogLine, onStreamDone
  }) {
    this.streamCallback = onLogLine;
    this.streamDoneCallback = onStreamDone;
  }

  async init() {
    this.logsList = await this.getLogs();

    this.read();
  }

  async read() {
    const log = await this.getNextLog();

    if (!log) { return this.streamDoneCallback(); }

    const stream = fs.createReadStream(`./logs/${log}`)
      .pipe(es.split())
      .pipe(es.mapSync(async line => {
        stream.pause();

        await this.streamCallback(line);
        
        stream.resume();
    }))
    .on('end', () => {
      this.read();
    })
  }

  async getNextLog() {
    return this.logsList.shift();
  }

  getLogs() {
    return new Promise(resolve => {
      fs.readdir('./logs', function(err, filenames) {
        resolve(filenames);
      });
    });
  }
}

class LogParser {
  async parse(log) {
    const ip = this.getIp(log);
    const userAgent = this.getUA(log);
    const browser = userAgent.family.replace(/['"]/g);
    const os = userAgent.os.family.replace(/['"]/g);
    const country = await IPResolverService(ip);

    return {
      browser, country, os
    };
  }

  getIp(log) {
    const [ip] = log.match(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/);

    return ip;
  }

  getUA(log) {
    const [userAgent] = log.match(/\"[^\"]+?\"$/)

    return ua.parse(userAgent);
  }
}

class Metric {
  store = {};

  constructor(name) {
    this.metricName = name;
  }

  add(prop) {
    if (!this.store[prop]) {  this.store[prop] = 0; }

    this.store[prop] ++;
  }

  calcPercents() {
    const sum = Object.values(this.store).reduce((acc, count) => acc + count, 0);
    const percents = [];

    Object.keys(this.store).forEach(prop => {
      const percent = 100 / (sum / this.store[prop]);

      percents.push({[prop]: Math.round((percent + Number.EPSILON) * 100) / 100})
    });

    return percents;
  }

  sort(arr) {
    return arr.sort((a, b) => Object.values(b)[0] - Object.values(a)[0]);
  }

  report() {
    const calculated = this.calcPercents(); 
    const sorted = this.sort(calculated);

    console.log(this.metricName, sorted);

    //post('https://stats.com?metric=' + this.metricName, sorted);
  }
}

class LogsStatisticsReporting {
  constructor() {
    this.logParser = new LogParser();
    this.logStream = new LogStreamReader({
      onLogLine: this.parseLogLine.bind(this),
      onStreamDone: this.sendStats.bind(this)
    });
    this.browser = new Metric('browser');
    this.os = new Metric('os');
    this.country = new Metric('country');
  }

  start() {
    this.logStream.init();
  }

  async parseLogLine(line) {
    try {
      const { browser, country, os } = await this.logParser.parse(line);

      this.browser.add(browser);
      this.country.add(country);
      this.os.add(os);
    } catch(e) {}
  }

  sendStats() {
    this.browser.report();
    this.country.report();
    this.os.report();
  }
}

const IPResolverService = async(ip) => {
  const countries = ['France', 'Israel', 'Germany', 'Italy', 'Russia', 'India', 'Spain', 'Romania', 'Greece'];

  return countries[Math.floor(Math.random() * countries.length)];
}

const stats = new LogsStatisticsReporting();
stats.start();
