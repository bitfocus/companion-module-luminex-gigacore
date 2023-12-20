import WebSocket from 'ws'

interface onOpen {
	(): void
}

interface onMessage {
	(data: any): void
}

interface onError {
	(msg: string): void
}

interface onDisconnect {
	(msg: string): void
}

interface WsCallbacks {
	onopen: onOpen
	onmessage: onMessage
	onerror: onError
	ondisconnect: onDisconnect
}

export interface Subscription {
	path: string
	method: 'full' | 'changes'
}

export class WS {
	ws: WebSocket | null = null
	reconnect_timer: NodeJS.Timeout | null = null
	ping_timer: NodeJS.Timeout | null = null
	pong_timeout: NodeJS.Timeout | null = null

	callbacks: WsCallbacks
	subscriptions: Subscription[]

	host: string
	constructor(host: string, callbacks: WsCallbacks, subscriptions: Subscription[]) {
		this.host = host
		this.callbacks = callbacks
		this.subscriptions = subscriptions
	}

	public init(): void {
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}

		const url = `ws://${this.host}/api/ws`

		if (this.ws) {
			this.ws.close(1000)
			this.ws = null
		}
		this.ws = new WebSocket(url)

		this.ws.onopen = this.websocketOpen.bind(this)
		this.ws.onclose = this.websocketClose.bind(this)
		this.ws.onmessage = this.messageReceivedFromWebSocket.bind(this)
		this.ws.onerror = this.websocketError.bind(this)
	}

	public close(): void {
		this.ws?.close(1000)
		this.ws = null
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
			this.reconnect_timer = null
		}
		if (this.ping_timer) {
			clearInterval(this.ping_timer)
			this.ping_timer = null
		}
		if (this.pong_timeout) {
			clearTimeout(this.pong_timeout)
			this.pong_timeout = null
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public send(data: any): void {
		if (this.ws) {
			//console.log(`send: ${JSON.stringify(data)}`)
			this.ws.send(data)
		} else {
			console.log(`Msg ${JSON.stringify(data)} lost because websocket not initialized yet`)
		}
	}

	websocketOpen(): void {
		this.initPingPong()
		this.callbacks.onopen()
		this.initSubscriptions()
	}

	websocketClose(event: WebSocket.CloseEvent): void {
		this.disconnect(`Connection closed with code ${event.code}`)
	}

	websocketError(event: WebSocket.Event): void {
		this.callbacks.onerror(JSON.stringify(event))
	}

	public disconnect(msg: string): void {
		this.callbacks.ondisconnect(msg)
		this.maybeReconnect()
	}

	maybeReconnect(): void {
		if (this.reconnect_timer) {
			clearTimeout(this.reconnect_timer)
		}
		if (this.ping_timer) {
			clearInterval(this.ping_timer)
			this.ping_timer = null
		}
		if (this.pong_timeout) {
			clearTimeout(this.pong_timeout)
			this.pong_timeout = null
		}
		this.reconnect_timer = setTimeout(() => {
			this.init()
		}, 5000)
	}

	initPingPong(): void {
		if (this.ping_timer) {
			clearInterval(this.ping_timer)
		}
		if (this.pong_timeout) {
			clearTimeout(this.pong_timeout)
			this.pong_timeout = null
		}
		this.ping_timer = setInterval(() => {
			if (this.pong_timeout) {
				clearTimeout(this.pong_timeout)
			}
			this.pong_timeout = setTimeout(() => {
				this.disconnect('Websocket Pong timeout')
			}, 3500)
			this.send('ping')
		}, 5000)
	}

	messageReceivedFromWebSocket(event: WebSocket.MessageEvent): void {
		let msgValue = null
		try {
			msgValue = JSON.parse(event.data.toString())
		} catch (e) {
			msgValue = event.data
		}

		if (msgValue === 'pong') {
			if (this.pong_timeout) {
				clearTimeout(this.pong_timeout)
				this.pong_timeout = null
			}
			return
		}

		this.callbacks.onmessage(msgValue)
	}

	initSubscriptions(): void {
		this.subscriptions.forEach((sub) => this.setSubscription(sub))
	}

	setSubscription(sub: Subscription): void {
		if (this.reconnect_timer) {
			return
		}

		const payload = JSON.stringify({
			subscription: {
				path: `/api/${sub.path}`,
				action: 'add',
				method: sub.method,
			},
		})
		this.send(payload)
	}
}
