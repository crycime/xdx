import { ClientOptions } from "../ClientOptions";
import { HuobiBase } from "./HuobiBase";
import { Market, Ticker } from "../index";

export class HuobiSwapsClient extends HuobiBase {
    public currentPrice = 0;
    public lastUpdateTime = 0;
    public market: Market;
    public startMsec: number;
    private _reconnecting = false;
    // constructor({ wssPath = "wss://api.hbdm.com/linear-swap-ws", watcherMs }: ClientOptions = {}) {
    constructor({ wssPath = "wss://api.hbdm.com/swap-ws", watcherMs }: ClientOptions = {}) {
        super({ name: "Huobi Swaps", wssPath, watcherMs });
        this.hasLevel2Updates = true;
        this.currentPrice = 0;
        this.lastUpdateTime = 0;
        this.startMsec = Date.now();
    }
    public Close = () => {
        this._reconnecting = false;
        super.close();
    };
    public Init = (market: Market) => {
        this.subscribeTicker(market);
        this.market = market;
        this.on("ticker", (ticker: Ticker, market: Market) => {
            this.currentPrice = (parseFloat(ticker.bid) + parseFloat(ticker.ask)) / 2;
            this.lastUpdateTime = Date.now();
            //console.log(ticker);
        });
        this.on("error", (err: any) => {
            this.currentPrice = 0;
            this.lastUpdateTime = 0;
            console.log("HuobiSwapsClient error:", this.startMsec, this.market, err);
            if (this._wss && !this._reconnecting) {
                this._reconnecting = true;
                setTimeout(() => {
                    if (this._reconnecting) {
                        console.log("HuobiSwapsClient reconnecting:", this.startMsec, this.market);
                        this.reconnect();
                        this._reconnecting = false;
                    }
                }, 1000);
            }
        });
        this.on("disconnected", (err: any) => {
            this.currentPrice = 0;
            this.lastUpdateTime = 0;
            console.log("HuobiSwapsClient disconnected:", this.startMsec, this.market, err);
        });
        this.on("closed", (err: any) => {
            this.currentPrice = 0;
            this.lastUpdateTime = 0;
            console.log("HuobiSwapsClient closed:", this.startMsec, this.market, err);
        });
        this.on("connecting", (err: any) => {
            this.currentPrice = 0;
            this.lastUpdateTime = 0;
            console.log("HuobiSwapsClient connecting:", this.startMsec, this.market, err);
        });
        this.on("connected", (err: any) => {
            this.currentPrice = 0;
            this.lastUpdateTime = 0;
            console.log("HuobiSwapsClient connected:", this.startMsec, this.market, err);
        });
        this.on("closing", (err: any) => {
            this.currentPrice = 0;
            this.lastUpdateTime = 0;
            console.log("HuobiSwapsClient closing:", this.startMsec, this.market, err);
        });
        console.log("HuobiSwapsClient init ok:", this.startMsec, this.market);
    };
    public GetCurrentPrice = () => {
        return this.currentPrice;
    };
}
