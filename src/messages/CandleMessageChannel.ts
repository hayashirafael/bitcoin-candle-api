import { Channel, connect } from 'amqplib'
import {config} from 'dotenv'
import { Server } from 'socket.io'
import * as http from 'http';
import CandleController from '../controllers/CandleController'
import { Candle } from 'src/models/CandleModel';

config()

//Funcao da classe
// Abrir conexao com a fila no rabbitMQ, consumir as msg, gravar no BD e mandar via socket para o front
export default class CandleMessageChannel {
    private _channel: Channel
    private _candleCtrl: CandleController
    private _io: Server

    constructor(server: http.Server) {
        this._candleCtrl = new CandleController()
        this._io = new Server(server, {
            cors: {
                origin: process.env.SOCKET_CLIENT_SERVER,
                methods: ["GET", "POST"]
            }
        })
        this._io.on('connection', () => console.log('Web socket connection created'))
        this._createMessageChannel()
    }
    //criar conexao com rabbitMQ
    private async _createMessageChannel() {
        try {
            const connection = await connect(process.env.AMQP_SERVER)
            this._channel = await connection.createChannel()
            this._channel.assertQueue(process.env.QUEUE_NAME)
        } catch (error) {
            console.log('Connection to RabbitMQ failed')
            console.log(error)
        }
    }

    //Consumir mensagens
    async consumeMessages() {
        await this._createMessageChannel()
        if (this._channel) {
            this._channel.consume(process.env.QUEUE_NAME, async (msg) => {
                const candleObj = JSON.parse(msg.content.toString())
                console.log('Message received')
                console.log(candleObj)
                this._channel.ack(msg)

                const candle: Candle = candleObj
                await this._candleCtrl.save(candle)
                console.log('Candle saved to database')
                this._io.emit(process.env.SOCKET_EVENT_NAME, candle)
                console.log('New candle emited by web socket')
            })
            console.log('Candle consumer started')
        }
    }
}