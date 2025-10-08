import { ModuleInstance } from './main.js'
import { FeedbackId } from './feedbacks.js'
import { FixedVariableId } from './variables.js'
import { WS, type Subscription } from './websocket.js'
import { Device, type Port, type PoePort, type Profile, type Group, type Trunk } from './device.js'
import { InstanceStatus, type CompanionVariableValues } from '@companion-module/base'

type Json = boolean | number | string | { [key: string]: Json } | Array<Json>

const wsSubscriptions: Subscription[] = [
	{
		path: 'device',
		method: 'full',
	},
	{
		path: 'ports/port',
		method: 'changes',
	},
	{
		path: 'groups/group',
		method: 'full',
	},
	{
		path: 'trunks/trunk',
		method: 'full',
	},
	{
		path: 'poe/capable',
		method: 'full',
	},
	{
		path: 'poe/ports',
		method: 'changes',
	},
	{
		path: 'config/name',
		method: 'full',
	},
	{
		path: 'config/profiles',
		method: 'changes',
	},
]

// Class for handling communication with GigaCore 'gen2' devices:
// - GigaCore30i
// - GigaCore20t
// - GigaCore18t
// - GigaCore16t
// - GigaCore16i
// - GigaCore10i
// - GigaCore10t
// - GigaCore16tf
// - GigaCore10t-IP
export class Gen2 extends Device {
	private ws?: WS

	constructor(instance: ModuleInstance) {
		super(instance)
	}

	async destroy(): Promise<void> {
		this.ws?.close()
		delete this.ws
		this.updateStatus(InstanceStatus.Disconnected)
	}

	public setConfig(host: string, password: string): void {
		super.setConfig(host, password)
		this.ws = new WS(
			host,
			{
				onopen: this.websocketOpen.bind(this),
				onmessage: this.websocketMessage.bind(this),
				onerror: this.websocketError.bind(this),
				ondisconnect: this.websocketDisconnect.bind(this),
			},
			wsSubscriptions,
		)
	}

	updateStatus(status: InstanceStatus, msg: string | null = null): void {
		this.instance.updateStatus(status, msg)
	}

	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
		this.instance.log(level, message)
	}

	// Gen-2 specific functions
	public initConnection(): void {
		const headers = new Headers()
		if (this.password !== '') {
			headers.set('Authorization', `Basic ${Buffer.from('admin:' + this.password).toString('base64')}`)
		}
		const options = {
			method: 'GET',
			headers: headers,
		}
		this.log('debug', 'init connection')
		fetch(`http://${this.host}/api/device`, options)
			.then(async (res) => {
				if (res.status == 200) {
					return res.json()
				}
				throw new Error(res.toString())
			})
			.then((data) => {
				if (typeof data === 'object' && data !== null) {
					this.log('debug', JSON.stringify(data))
					const changedVariables: CompanionVariableValues = {}
					if ('name' in data && typeof data.name === 'string') {
						changedVariables[FixedVariableId.deviceName] = data.name
					}
					if ('description' in data && typeof data.description === 'string') {
						changedVariables[FixedVariableId.description] = data.description
					}
					if ('serial' in data && typeof data.serial === 'string') {
						changedVariables[FixedVariableId.serial] = data.serial
					}
					if ('mac_address' in data && typeof data.mac_address === 'string') {
						changedVariables[FixedVariableId.macAddress] = data.mac_address
					}
					if ('model' in data && typeof data.model === 'string') {
						changedVariables[FixedVariableId.model] = data.model
					}
					this.instance.setVariableValues(changedVariables)
					this.initWebSocket()
				} else {
					this.updateStatus(InstanceStatus.ConnectionFailure)
				}
			})
			.catch((error) => {
				this.log('debug', `failed connection: ${JSON.stringify(error)}`)
				this.log('debug', JSON.stringify(error))
				this.updateStatus(InstanceStatus.ConnectionFailure)
			})
	}

	public disconnect(msg: string): void {
		this.ws?.disconnect(msg)
	}

	public getNrProfiles(): number {
		return 40
	}

	public getMaxGroups(): number {
		return 255
	}

	public getMaxTrunks(): number {
		return 255
	}

	initWebSocket(): void {
		this.ws?.init()
	}

	websocketOpen(): void {
		this.updateStatus(InstanceStatus.Ok)
		this.log('debug', `Connection opened to ${this.host}`)
	}

	websocketError(data: string): void {
		this.log('error', `WebSocket error: ${data}`)
	}

	websocketDisconnect(msg: string): void {
		this.log('debug', msg)
		this.updateStatus(InstanceStatus.Disconnected, msg)
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	websocketMessage(msgValue: any): void {
		if (msgValue && msgValue.api_notification) {
			if (['path', 'new_value'].every((key) => Object.keys(msgValue.api_notification).includes(key))) {
				const path = msgValue.api_notification.path
				const data = msgValue.api_notification.new_value
				const cmd = path.replace('/api/', '')
				//this.log('debug', `ws message from ${cmd}  : ${JSON.stringify(data)}`)
				this.processData(cmd, data)
			} else {
				this.log('debug', `invalid msg: ${JSON.stringify(msgValue.api_notification)}`)
			}
		}
	}

	private sendCommand(cmd: string, type: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined, params: Json): void {
		const url = `http://${this.host}/api/${cmd}`
		const requestHeaders = new Headers()
		requestHeaders.set('Content-Type', 'application/json')
		if (this.password !== '') {
			requestHeaders.set('Authorization', `Basic ${Buffer.from('admin:' + this.password).toString('base64')}`)
		}
		const options = {
			method: type,
			body: params != undefined ? JSON.stringify(params) : null,
			headers: requestHeaders,
		}

		this.log('debug', cmd)
		if (params) {
			this.log('debug', JSON.stringify(options))
		}

		fetch(url, options)
			.then(async (res) => {
				if (res.ok) {
					const contentType = res.headers.get('content-type')
					if (contentType && contentType.indexOf('application/json') !== -1) {
						return res.json() as Promise<Json>
					}
					throw new Error(`Unexpected content type: ${contentType}`)
				} else {
					this.log('error', `Error on ${cmd}: ${JSON.stringify(res)}`)
					throw new Error(res.toString())
				}
			})
			.then((json) => {
				this.processData(cmd, json)
			})
			.catch((error) => {
				this.log('debug', `CMD error: ${JSON.stringify(error)}`)
			})
	}

	private processData(cmd: string, data: Json): void {
		if (cmd.startsWith('device')) {
			if (typeof data === 'object' && data && 'name' in data && 'description' in data) {
				this.instance.setVariableValues({
					[FixedVariableId.deviceName]: data.name.toString(),
					[FixedVariableId.description]: data.description.toString(),
				})
			}
		} else if (cmd.startsWith('ports/port') && cmd.endsWith('member_of')) {
			// ignore
		} else if (cmd.startsWith('ports/port') && cmd.endsWith('enabled')) {
			// ignore
		} else if (cmd.startsWith('ports/port')) {
			if (!Array.isArray(data)) {
				this.log('error', `Unexpected type for response to ${cmd}: ${data}`)
				return
			}
			const variables: CompanionVariableValues = {}
			let link_state_change = false
			let enabled_change = false
			let member_of_change = false
			let protect_change = false
			if (!this.nr_ports) {
				link_state_change = true
				enabled_change = true
				member_of_change = true
				protect_change = true
				this.nr_ports = data.length
				const ports: Port[] = []
				data.forEach((port: any) => {
					ports.push({
						port_number: port.port_number,
						legend: port.legend,
						enabled: port.enabled,
						protected: port.protected,
						link_up: port.link_state !== 'down',
						member_of: port.member_of,
					})
					const id = port.port_number
					variables[`port_${id}_legend`] = port.legend
					variables[`port_${id}_enabled`] = port.enabled
					variables[`port_${id}_up`] = port.link_state !== 'down'
					variables[`port_${id}_protected`] = port.protected
					variables[`port_${id}_member_id`] = port.member_of.id
					variables[`port_${id}_member_type`] = port.member_of.type
					const res = this.getMemberOfNameAndColor(port.member_of)
					if (res) {
						variables[`port_${id}_member_name`] = res.name
						variables[`port_${id}_member_color`] = res.color
					}
				})
				this.ports = ports
				this.instance.initActions()
				this.instance.initVariables()
				this.instance.initPresets()
				variables[FixedVariableId.nrPorts] = this.nr_ports
			} else {
				data.forEach((port: any) => {
					const id = port.port_number
					const port_idx = this.ports.findIndex((p) => p.port_number === id)
					if ('legend' in port) {
						this.ports[port_idx].legend = port.legend
						variables[`port_${id}_legend`] = port.legend
					}
					if ('link_state' in port) {
						const up = port.link_state !== 'down'
						this.ports[port_idx].link_up = up
						variables[`port_${id}_up`] = up
						link_state_change = true
					}
					if ('enabled' in port) {
						this.ports[port_idx].enabled = port.enabled
						variables[`port_${id}_enabled`] = port.enabled
						enabled_change = true
					}
					if ('protected' in port) {
						this.ports[port_idx].protected = port.protected
						variables[`port_${id}_protected`] = port.protected
						protect_change = true
					}
					if ('member_of' in port) {
						if ('id' in port.member_of) {
							this.ports[port_idx].member_of.id = port.member_of.id
							variables[`port_${id}_member_id`] = port.member_of.id
						}
						if ('type' in port.member_of) {
							this.ports[port_idx].member_of.type = port.member_of.type
							variables[`port_${id}_member_type`] = port.member_of.type
						}
						const res = this.getMemberOfNameAndColor(this.ports[port_idx].member_of)
						if (res) {
							variables[`port_${id}_member_name`] = res.name
							variables[`port_${id}_member_color`] = res.color
						}
						member_of_change = true
					}
				})
			}
			this.instance.setVariableValues(variables)
			if (link_state_change) {
				this.instance.checkFeedbacks(FeedbackId.portState)
			}
			if (enabled_change) {
				this.instance.checkFeedbacks(FeedbackId.portDisabled)
			}
			if (member_of_change) {
				this.instance.checkFeedbacks(FeedbackId.portColor, FeedbackId.selectedPortColor)
			}
			if (protect_change) {
				this.instance.checkFeedbacks(FeedbackId.portProtected, FeedbackId.selectedPortProtected)
			}
		} else if (cmd.startsWith('groups/group')) {
			if (!data) {
				return
			}
			if (!Array.isArray(data)) {
				this.log('error', `Unexpected type for response to ${cmd}: ${data}`)
				return
			}
			const variables: CompanionVariableValues = {}
			data.forEach((group: any) => {
				const id = group.group_id
				variables[`group_${id}_name`] = group.name
				variables[`group_${id}_color`] = group.color
			})
			if (!this.groups || this.groups.length !== data.length) {
				this.groups = data as unknown as Group[]
				this.instance.initVariables()
				this.instance.initPresets()
			} else {
				this.groups = data as unknown as Group[]
			}
			this.instance.setVariableValues(variables)
			this.instance.checkFeedbacks(
				FeedbackId.portColor,
				FeedbackId.selectedPortColor,
				FeedbackId.groupColor,
				FeedbackId.selectedGroupColor,
			)
		} else if (cmd.startsWith('trunks/trunk')) {
			if (!data) {
				return
			}
			if (!Array.isArray(data)) {
				this.log('error', `Unexpected type for response to ${cmd}: ${data}`)
				return
			}
			const variables: CompanionVariableValues = {}
			data.forEach((trunk: any) => {
				const id = trunk.trunk_id
				variables[`trunk_${id}_name`] = trunk.name
				variables[`trunk_${id}_color`] = trunk.color
			})
			if (!this.trunks || this.trunks.length !== data.length) {
				this.trunks = data as unknown as Trunk[]
				this.instance.initVariables()
			} else {
				this.trunks = data as unknown as Trunk[]
			}
			this.instance.setVariableValues(variables)
			this.instance.checkFeedbacks(
				FeedbackId.portColor,
				FeedbackId.selectedPortColor,
				FeedbackId.groupColor,
				FeedbackId.selectedGroupColor,
			)
		} else if (cmd.startsWith('poe/capable')) {
			if (typeof data !== 'boolean') {
				this.log('error', `Unexpected type for response to ${cmd}: ${data}`)
				return
			}
			this.poe_capable = data
			const variables: CompanionVariableValues = {}
			variables[FixedVariableId.poeCapable] = this.poe_capable
			this.instance.initFeedbacks()
			this.instance.setVariableValues(variables)
		} else if (cmd.startsWith('poe/ports')) {
			if (!data) {
				return
			}
			if (!Array.isArray(data)) {
				this.log('error', `Unexpected type for response to ${cmd}: ${data}`)
				return
			}
			const variables: CompanionVariableValues = {}
			let enabled_change = false
			let sourcing_change = false
			if (!this.poe_ports.length) {
				const poe_ports: PoePort[] = []
				enabled_change = true
				sourcing_change = true
				data.forEach((port: any) => {
					poe_ports.push({
						port_number: port.port_number,
						enabled: port.enabled,
						sourcing: port.indication === 'sourcing',
					})
					const id = port.port_number
					variables[`port_${id}_poe_enabled`] = port.enabled
					variables[`port_${id}_poe_sourcing`] = port.indication === 'sourcing'
				})
				this.poe_ports = poe_ports
				this.instance.initVariables()
				this.instance.initPresets()
			} else {
				data.forEach((port: any) => {
					const id = port.port_number
					const port_idx = this.poe_ports.findIndex((p) => p.port_number === id)
					if ('enabled' in port) {
						this.poe_ports[port_idx].enabled = port.enabled
						variables[`port_${id}_poe_enabled`] = port.enabled
						enabled_change = true
					}
					if ('indication' in port) {
						this.poe_ports[port_idx].sourcing = port.indication === 'sourcing'
						variables[`port_${id}_poe_sourcing`] = port.indication === 'sourcing'
						sourcing_change = true
					}
				})
			}
			this.instance.setVariableValues(variables)
			if (enabled_change) {
				this.instance.checkFeedbacks(FeedbackId.poeEnabled)
			}
			if (sourcing_change) {
				this.instance.checkFeedbacks(FeedbackId.poeSourcing)
			}
		} else if (cmd.startsWith('config/name')) {
			if (typeof data !== 'string') {
				this.log('error', `Unexpected type for response to ${cmd}: ${data}`)
				return
			}
			const variables: CompanionVariableValues = {}
			variables[FixedVariableId.activeProfile] = data
			this.instance.setVariableValues(variables)
		} else if (cmd.startsWith('identify')) {
			// Nothing to do
		} else if (cmd.startsWith('reboot')) {
			// Nothing to do
		} else if (cmd.startsWith('reset')) {
			// Nothing to do
		} else if (cmd.startsWith('config/profiles') && cmd.endsWith('recall')) {
			// Nothing to do
		} else if (cmd.startsWith('config/profiles') && cmd.endsWith('save')) {
			// Nothing to do
		} else if (cmd.startsWith('config/profiles')) {
			if (!Array.isArray(data)) {
				this.log('error', `Unexpected type for response to ${cmd}: ${data}`)
				return
			}
			const variables: CompanionVariableValues = {}
			let protect_change = false
			if (!this.profiles.length) {
				protect_change = true
				const profiles: Profile[] = []
				data.forEach((profile: any) => {
					const id = profile.slot + 1
					profiles.push({
						id: id,
						name: profile.name,
						empty: profile.name === '__empty__',
						protected: profile.protected,
					})
					variables[`profile_${id}_name`] = profile.name
				})
				this.profiles = profiles
			} else {
				data.forEach((profile: any) => {
					const id = profile.slot + 1
					const profile_idx = this.profiles.findIndex((p) => p.id === id)
					if ('name' in profile) {
						variables[`profile_${id}_name`] = profile.name
						this.profiles[profile_idx].name = profile.name
						this.profiles[profile_idx].empty = profile.name === '__empty__'
					}
					if ('protected' in profile) {
						if (this.profiles[profile_idx].protected != profile.protected) {
							this.profiles[profile_idx].protected = profile.protected
							protect_change = true
						}
					}
				})
			}
			this.instance.setVariableValues(variables)
			if (protect_change) {
				this.instance.checkFeedbacks(FeedbackId.profileProtected)
			}
		} else {
			this.log('debug', `Unhandled command ${cmd}: ${JSON.stringify(data)}`)
		}
	}

	public identify(duration: number): void {
		this.log('debug', 'identify')
		this.sendCommand(`identify`, 'PUT', {
			duration: duration,
		})
	}

	public reboot(wait: number): void {
		this.sendCommand(`reboot`, 'PUT', {
			wait: wait,
		})
		setTimeout(() => this.disconnect(`Reboot triggered`), wait + 500)
	}

	public reset(keep_ip: boolean, keep_profiles: boolean, wait: number): void {
		this.sendCommand(`reset`, 'PUT', {
			keep_ip: keep_ip,
			keep_profiles: keep_profiles,
			wait: wait,
		})
		setTimeout(() => this.disconnect(`Reset triggered`), wait + 500)
	}

	public recallProfile(profile: number, keep_ip: boolean, wait: number): void {
		if (this.getProfileEmpty(profile)) {
			this.log('info', `Profile ${profile} is empty and cannot be recalled`)
			return
		}
		const profile_id = profile - 1
		this.sendCommand(`config/profiles/${profile_id}/recall`, 'PUT', {
			keep_ip: keep_ip,
			wait: wait,
		})
		setTimeout(() => this.disconnect(`Profile recall triggered`), wait + 500)
	}

	public saveProfile(profile: number, name: string): void {
		if (this.getProfileProtected(profile)) {
			this.log('info', `Profile ${profile} is protected and cannot be overwritten`)
			return
		}
		const profile_id = profile - 1
		this.sendCommand(`config/profiles/${profile_id}/save`, 'PUT', {
			name: name,
		})
	}

	public setPortToGroup(port_nr: number, group_id: number): void {
		if (this.getPortProtected(port_nr)) {
			this.log('info', `Port ${port_nr} is protected and cannot be changed`)
			return
		}
		this.log('info', `Changing group of port ${port_nr} to ${group_id}`)
		this.sendCommand(`ports/port/${port_nr}/member_of`, 'PUT', {
			type: 'group',
			id: group_id,
		})
	}

	public setPortToTrunk(port_nr: number, trunk_id: number): void {
		if (this.getPortProtected(port_nr)) {
			this.log('info', `Port ${port_nr} is protected and cannot be changed`)
			return
		}
		this.log('info', `Changing trunk of port ${port_nr} to ${trunk_id}`)
		this.sendCommand(`ports/port/${port_nr}/member_of`, 'PUT', {
			type: 'trunk',
			id: trunk_id,
		})
	}

	public incrementMemberOf(port_nr: number): void {
		if (this.getPortProtected(port_nr)) {
			this.log('info', `Port ${port_nr} is protected and cannot be changed`)
			return
		}
		if (!this.ports) {
			return
		}
		const port = this.ports.find((p) => p.port_number === port_nr)
		if (!port) {
			return
		}
		let new_id = port.member_of.id
		if (port.member_of.type === 'group') {
			let idx = this.groups.findIndex((g) => g.group_id === new_id) + 1
			if (idx >= this.groups.length) {
				idx = 0
			}
			new_id = this.groups[idx].group_id
		} else if (port.member_of.type === 'trunk') {
			let idx = this.trunks.findIndex((g) => g.trunk_id === new_id) + 1
			if (idx >= this.trunks.length) {
				idx = 0
			}
			new_id = this.trunks[idx].trunk_id
		}
		this.log('info', `Changing ${port.member_of.type} of port ${port_nr} to ${new_id}`)
		this.sendCommand(`ports/port/${port_nr}/member_of`, 'PUT', {
			type: port.member_of.type,
			id: new_id,
		})
	}

	public setPortPoe(port_nr: number, enabled: boolean): void {
		if (this.getPortProtected(port_nr)) {
			this.log('info', `Port ${port_nr} is protected and cannot be changed`)
			return
		}
		this.sendCommand(`poe/ports/${port_nr}/enabled`, 'PUT', enabled)
		// If disabling, reset sourcing immediately
		if (enabled === false) {
			const port = this.poe_ports.findIndex((p) => p.port_number === port_nr)
			this.poe_ports[port].sourcing = false
			this.instance.checkFeedbacks(FeedbackId.poeSourcing)
		}
	}

	public setPortLink(port_nr: number, enabled: boolean): void {
		if (this.getPortProtected(port_nr)) {
			this.log('info', `Port ${port_nr} is protected and cannot be changed`)
			return
		}
		this.log('debug', `new Speed for ${port_nr} to state ${enabled}`)
		this.sendCommand(`ports/port/${port_nr}/enabled`, 'PUT', enabled)
	}
}
