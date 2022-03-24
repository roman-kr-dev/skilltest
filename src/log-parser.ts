import fs from 'fs';
import es from 'event-stream';
import useragent from 'useragent';
import geoip from 'geoip-country';

interface ApacheLog {
  ip: string;
  time: string;
  method: string;
  resource: string;
  protocol: string;
  statusCode: number;
  size: number;
  referer: string;
  userAgent: any;
  browser: string;
  os: string;
  country: string;
};

interface LogStreamProps {
  onLogLine: Function,
  onStreamDone: Function
}

class LogStreamReader {
  streamCallback: Function;
  streamDoneCallback: Function
  logsList: Array<string> | null = null;

  constructor({
    onLogLine, 
    onStreamDone
  }: LogStreamProps) {
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
      .pipe(es.mapSync(async (line: string) => {
        stream.pause();

        await this.streamCallback(line);
        
        stream.resume();
    }))
    .on('end', () => {
      this.read();
    })
  }

  async getNextLog() {
    return this.logsList!.shift();
  }

  getLogs(): Promise<Array<string>> {
    return new Promise(resolve => {
      fs.readdir('./logs', function(err, filenames) {
        resolve(filenames);
      });
    });
  }
}

class LogParser {
  parse(log: string): ApacheLog {
    let [ ip, i1, i2, ts, tz, method, resource, protocol, statusCode, size, referer, ...ua ] = log.split(' ');

    ts = ts.substring(1);
    tz = tz.substring(0, tz.length - 1);
    const time = ts + tz;

    // put our User-Agent back together
    let userAgent = useragent.parse(ua.join(''));
    let browser = userAgent.family.replace(/['"]/g, '');
    let os = userAgent.os.family.replace(/['"]/g, '');
    let { country } = geoip.lookup(ip) || { country: 'N/A' };
    
    return { ip, time, method, resource, protocol, statusCode: +statusCode, size: +size, referer, userAgent, browser, os, country };
  }
}

class Metric {
  logsCounter = 0;
  store: any = {};
  metric: keyof ApacheLog;

  constructor(name: keyof ApacheLog) {
    this.metric = name;
  }

  add(log: ApacheLog) {
    this.logsCounter ++;

    const prop = log[this.metric];

    if (!prop) { return; }
    if (!this.store[prop]) {  this.store[prop] = 0; }

    this.store[prop] ++;
  }

  calcPercents() {
    const percents: Array<any> = [];

    Object.keys(this.store).forEach(prop => {
      const percent = 100 / (this.logsCounter / this.store[prop]);

      percents.push({[prop]: Math.round((percent + Number.EPSILON) * 100) / 100})
    });

    return percents;
  }

  sort(arr: Array<any>) {
    return arr.sort((a, b) => (Object.values(b)[0] as number) - (Object.values(a)[0] as number));
  }

  report() {
    const calculated = this.calcPercents(); 
    const sorted = this.sort(calculated);

    console.log(this.metric, sorted);

    //post('https://stats.com?metric=' + this.metricName, sorted);
  }
}

class LogsStatisticsReporting {
  logParser: LogParser;
  logStream: LogStreamReader;

  metrics = [
    new Metric('browser'),
    new Metric('os'), 
    new Metric('country')
  ]

  constructor() {
    this.logParser = new LogParser();
    this.logStream = new LogStreamReader({
      onLogLine: this.parseLogLine.bind(this),
      onStreamDone: this.sendStats.bind(this)
    });
  }

  start() {
    this.logStream.init();
  }

  async parseLogLine(line: string) {
    try {
      const log = this.logParser.parse(line);

      this.metrics.forEach(metric => metric.add(log));
    } catch(e) {}
  }

  sendStats() {
    this.metrics.forEach(metric => metric.report());
  }
}

const stats = new LogsStatisticsReporting();
stats.start();