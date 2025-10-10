import { ModuleInstance } from './main.js'
import { FeedbackId } from './feedbacks.js'
import { FixedVariableId } from './variables.js'
import { Device, type Port, type PoePort, type Profile, type Group, type Trunk, type MemberOf } from './device.js'
import { InstanceStatus, type CompanionVariableValues } from '@companion-module/base'

// Class for handling communication with GigaCore 'gen1' devices:
// - GigaCore10
// - GigaCore12
// - GigaCore14R
// - GigaCore16Xt
// - GigaCore16RFO
// - GigaCore26i
export class Gen1 extends Device {
	devicePoll?: NodeJS.Timeout
	deviceLongPoll?: NodeJS.Timeout

	private safeStringify(value: unknown): string {
		try {
			if (typeof value === 'string') return value
			if (value === null) return 'null'
			if (value === undefined) return 'undefined'
			return JSON.stringify(value)
		} catch (_) {
			return String(value)
		}
	}
	constructor(instance: ModuleInstance) {
		super(instance)
	}

	public async destroy(): Promise<void> {
		this.stopDevicePoll()
		this.updateStatus(InstanceStatus.Disconnected)
	}

	public setConfig(host: string, password: string): void {
		super.setConfig(host, password)
	}

	public initConnection(): void {
		this.stopDevicePoll()
		const requestHeaders = new Headers()
		requestHeaders.set('Authorization', `Basic ${Buffer.from('admin:' + this.password).toString('base64')}`)
		const options = {
			method: 'GET',
			headers: requestHeaders,
		}
		this.log('debug', 'init connection')
		fetch(`http://${this.host}/config/switchlegend`, options)
			.then(async (res) => {
				if (res.status == 200) {
					return res.text()
				} else {
					this.log('debug', `Failed connection to ${this.host}, response code ${res.status}`)
					throw new Error(this.safeStringify(res))
				}
			})
			.then((data) => {
				this.log('debug', data)
				const params = data.split(',', 7)
				const changedVariables: CompanionVariableValues = {}
				changedVariables[FixedVariableId.deviceName] = decodeURI(params[0])
				changedVariables[FixedVariableId.serial] = params[3]
				changedVariables[FixedVariableId.description] = decodeURI(params[1])
				changedVariables[FixedVariableId.macAddress] = params[6]
				changedVariables[FixedVariableId.model] = 'GigaCore'
				this.instance.setVariableValues(changedVariables)

				this.updateStatus(InstanceStatus.Ok)
				this.sendCommand('config/ports', 'GET')
				this.startDevicePoll()
			})
			.catch((error) => {
				this.log('debug', 'failed connection')
				this.log('debug', JSON.stringify(error))
				this.updateStatus(InstanceStatus.ConnectionFailure)
			})
	}

	public disconnect(msg: string): void {
		this.log('debug', msg)
		this.updateStatus(InstanceStatus.Disconnected, msg)
		// keep polling until device is back
	}

	public getNrProfiles(): number {
		return 10
	}

	public getMaxGroups(): number {
		return 20
	}

	public getMaxTrunks(): number {
		return 1
	}

	private getDeviceInfo(): void {
		this.sendCommand('config/switchlegend', 'GET')
		this.sendCommand('config/portlegend', 'GET')
		this.sendCommand('config/ports', 'GET')
		this.sendCommand('config/poe_config', 'GET')
		this.sendCommand('config/groups', 'GET')
		this.sendCommand('config/portprotect', 'GET')
		if (this.poe_capable) {
			this.sendCommand('stat/poe_status', 'GET')
		}
	}

	private getProfileNames(): void {
		this.sendCommand('config/profile_name', 'GET')
		this.sendCommand('config/icfg_profile_list', 'GET')
	}

	private startDevicePoll(): void {
		this.stopDevicePoll()

		this.getDeviceInfo()
		this.getProfileNames()

		this.devicePoll = setInterval(() => {
			this.getDeviceInfo()
		}, 5000)

		this.deviceLongPoll = setInterval(() => {
			this.getProfileNames()
		}, 15000)
	}

	private stopDevicePoll(): void {
		if (this.devicePoll) {
			clearInterval(this.devicePoll)
			delete this.devicePoll
		}
		if (this.deviceLongPoll) {
			clearInterval(this.deviceLongPoll)
			delete this.deviceLongPoll
		}
	}

	private sendCommand(
		cmd: string,
		type: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | undefined,
		params: any = undefined,
	): void {
		const url = `http://${this.host}/${cmd}`
		const requestHeaders = new Headers()
		if (type && type !== 'GET') {
			requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded')
		}
		requestHeaders.set('Authorization', `Basic ${Buffer.from('admin:' + this.password).toString('base64')}`)

		const options = {
			method: type,
			body: params !== undefined ? new URLSearchParams(params) : null,
			headers: requestHeaders,
		}

		this.log('debug', cmd)
		if (params) {
			this.log('debug', JSON.stringify(options))
		}

		fetch(url, options)
			.then(async (res) => {
				if (res.ok) {
					if (!this.connected) {
						this.updateStatus(InstanceStatus.Ok)
					}
					if (type !== 'GET') {
						return
					}
					const contentType = res.headers.get('content-type')
					if (contentType && contentType.indexOf('application/json') !== -1) {
						res
							.json()
							.then((data) => {
								this.processJsonData(cmd, data)
							})
							.catch((e) => {
								this.log('debug', `CMD error: ${JSON.stringify(e)}`)
							})
					} else {
						res
							.text()
							.then((data) => {
								this.processData(cmd, data)
							})
							.catch((e) => {
								this.log('debug', `CMD error: ${JSON.stringify(e)}`)
							})
					}
				} else {
					throw new Error(this.safeStringify(res))
				}
			})
			.catch((error) => {
				this.log('debug', `CMD error: ${JSON.stringify(error)}`)
			})
	}

	private processJsonData(cmd: string, data: any): void {
		if (cmd.startsWith('config/portprotect')) {
			if (!Array.isArray(data)) {
				this.log('error', `Unexpected type for response to ${cmd}: ${this.safeStringify(data)}`)
				return
			}
			const variables: CompanionVariableValues = {}
			let protect_change = false
			data.forEach((port: any) => {
				const id = port.port
				const port_idx = this.ports.findIndex((p) => p.port_number === id)
				if ('protect' in port && port.protect !== this.getVariableValue(`port_${id}_protected`)) {
					this.ports[port_idx].protected = port.protect
					variables[`port_${id}_protected`] = port.protect
					protect_change = true
				}
			})
			this.instance.setVariableValues(variables)
			if (protect_change) {
				this.instance.checkFeedbacks(FeedbackId.portProtected, FeedbackId.selectedPortProtected)
			}
		} else {
			this.log('debug', `Unhandled command ${cmd}: ${JSON.stringify(data)}`)
		}
	}

	private processData(cmd: string, data: string): void {
		if (cmd.startsWith('config/switchlegend')) {
			const params = data.split(',', 7)
			this.instance.setVariableValues({
				device_name: decodeURI(params[0]),
				description: decodeURI(params[1]),
			})
		} else if (cmd.startsWith('config/portlegend')) {
			const params = data.split('/', 26)
			const changedVariables: CompanionVariableValues = {}
			params.forEach((port, i) => {
				const port_nr = i + 1
				const port_legend = decodeURI(port)
				const port_idx = this.ports.findIndex((p) => p.port_number === port_nr)
				if (!this.ports[port_idx]) {
					return
				}

				if (this.ports[port_idx].legend !== port_legend) {
					changedVariables[`port_${port_nr}_legend`] = port_legend
					this.ports[port_idx].legend = port_legend
				}
			})
			this.instance.setVariableValues(changedVariables)
		} else if (cmd.startsWith('config/profile_name')) {
			const name = data.slice(1, -1)
			const changedVariables: CompanionVariableValues = {}
			changedVariables[FixedVariableId.activeProfile] = decodeURI(name)
			this.instance.setVariableValues(changedVariables)
		} else if (cmd.startsWith('config/icfg_profile_list')) {
			const changedVariables: CompanionVariableValues = {}
			const params = data.split('*', 10)
			if (!this.profiles.length) {
				const profiles: Profile[] = []
				params.forEach((profile, i) => {
					const id = i + 1
					const profile_name = decodeURI(profile.substring(5))
					changedVariables[`profile_${id}_name`] = profile_name
					profiles.push({
						id: id,
						name: profile_name,
						empty: profile_name === '',
						protected: false,
					})
				})
				this.profiles = profiles
			} else {
				params.forEach((profile, i) => {
					const id = i + 1
					const profile_name = decodeURI(profile.substring(5))
					changedVariables[`profile_${id}_name`] = profile_name
					const profile_idx = this.profiles.findIndex((p) => p.id === id)
					this.profiles[profile_idx].name = profile_name
					this.profiles[profile_idx].empty = profile_name === ''
				})
			}
			this.instance.setVariableValues(changedVariables)
		} else if (cmd.startsWith('config/poe_config')) {
			const params = data.split('|', 4)
			const poe_capable = params[0] === '1'
			const ports = params[3].split(',', 26)

			const variables: CompanionVariableValues = {}
			if (this.poe_capable !== poe_capable) {
				this.poe_capable = poe_capable
				this.instance.initVariables()
				this.instance.initPresets()
				this.instance.initFeedbacks()
				variables[FixedVariableId.poeCapable] = poe_capable
			}
			if (!this.poe_capable) {
				this.instance.setVariableValues(variables)
				return
			}

			let enabled_change = false
			let sourcing_change = false
			if (!this.poe_ports.length) {
				const poe_ports: PoePort[] = []
				enabled_change = true
				sourcing_change = true
				ports.forEach((val) => {
					const port_config = val.split('/', 5)
					const port_nr = parseInt(port_config[0])
					if (Number.isNaN(port_nr)) {
						return
					}
					const enabled = port_config[3] !== '0'
					const port: PoePort = {
						port_number: port_nr,
						enabled: enabled,
						sourcing: false,
					}
					poe_ports.push(port)
					variables[`port_${port_nr}_poe_enabled`] = port.enabled
					variables[`port_${port_nr}_poe_sourcing`] = port.sourcing
				})
				this.poe_ports = poe_ports
				this.instance.initVariables()
				this.instance.initPresets()
			} else {
				ports.forEach((val) => {
					const port_config = val.split('/', 5)
					const port_nr = parseInt(port_config[0])
					if (Number.isNaN(port_nr)) {
						return
					}
					const enabled = port_config[3] !== '0'

					const port_idx = this.poe_ports.findIndex((p) => p.port_number === port_nr)
					if (enabled !== this.poe_ports[port_idx].enabled) {
						this.poe_ports[port_idx].enabled = enabled
						enabled_change = true
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
		} else if (cmd.startsWith('stat/poe_status')) {
			if (!this.poe_capable) {
				return
			}
			const ports = data.substring(1).split('|', 26)
			const variables: CompanionVariableValues = {}
			let sourcing_change = false
			ports.forEach((val) => {
				const port_config = val.split('/', 8)
				const port_nr = parseInt(port_config[0])

				if (Number.isNaN(port_nr)) {
					return
				}

				const sourcing = port_config[5] === 'PoE turned ON'
				const port_idx = this.poe_ports.findIndex((p) => p.port_number === port_nr)
				if (sourcing !== this.poe_ports[port_idx].sourcing) {
					this.poe_ports[port_idx].sourcing = sourcing
					sourcing_change = true
					variables[`port_${port_nr}_poe_sourcing`] = sourcing
				}
			})
			if (sourcing_change) {
				this.instance.checkFeedbacks(FeedbackId.poeSourcing)
			}
		} else if (cmd.startsWith('config/ports')) {
			const port_values = data.split('|', 26)
			const variables: CompanionVariableValues = {}
			let link_state_change = false
			let enabled_change = false
			let member_of_change = false
			if (!this.ports.length) {
				link_state_change = true
				enabled_change = true
				member_of_change = true
				this.instance.setVariableValues({
					nr_ports: port_values.length - 1,
				})
				this.nr_ports = port_values.length - 1
				const ports: Port[] = []
				port_values.forEach((val) => {
					const params = val.split('/')
					const port_nr = parseInt(params[0])
					if (Number.isNaN(port_nr)) {
						return
					}
					const enabled = params[2] !== '0'
					const link_up = params[9] === 'Up'
					const port: Port = {
						port_number: port_nr,
						enabled: enabled,
						legend: `Port ${port_nr}`,
						protected: false, // TODO
						link_up: link_up,
						member_of: {
							id: 0,
							type: 'none',
						},
					}
					ports.push(port)
					variables[`port_${port_nr}_legend`] = port.legend
					variables[`port_${port_nr}_enabled`] = port.enabled
					variables[`port_${port_nr}_up`] = port.link_up
					variables[`port_${port_nr}_protected`] = port.protected
				})
				this.ports = ports
				this.instance.initActions()
				this.instance.initVariables()
				this.instance.initPresets()
				let model = 'GigaCore'
				if (this.nr_ports === 10) {
					model = 'GigaCore10'
				} else if (this.nr_ports === 12) {
					model = 'GigaCore12'
				} else if (this.nr_ports === 14) {
					model = 'GigaCore14R'
				} else if (this.nr_ports === 16) {
					model = 'GigaCore16Xt/RFO'
				} else if (this.nr_ports === 26) {
					model = 'GigaCore26i'
				}
				variables[FixedVariableId.nrPorts] = this.nr_ports
				variables[FixedVariableId.model] = model
			} else {
				port_values.forEach((val) => {
					const params = val.split('/')
					const port_nr = parseInt(params[0])
					if (Number.isNaN(port_nr)) {
						return
					}
					const enabled = params[2] !== '0'
					const link_up = params[9] === 'Up'
					const port_idx = this.ports.findIndex((p) => p.port_number === port_nr)

					if (enabled !== this.ports[port_idx].enabled) {
						this.ports[port_idx].enabled = enabled
						variables[`port_${port_nr}_enabled`] = enabled
						enabled_change = true
					}
					if (link_up !== this.ports[port_idx].link_up) {
						this.ports[port_idx].link_up = link_up
						variables[`port_${port_nr}_up`] = link_up
						link_state_change = true
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
		} else if (cmd.startsWith('config/groups')) {
			const groups = data.split('|', 21)
			const group_values: Group[] = []
			const trunk_values: Trunk[] = []
			const variables: CompanionVariableValues = {}
			let member_of_change = false
			groups.forEach((value) => {
				const params = value.split('/')
				const id = parseInt(params[0])
				if (Number.isNaN(id)) {
					return
				}
				const group = {
					id: id,
					name: decodeURI(params[2]),
					ports: params[3].split(',').map((x) => parseInt(x)),
					color: params[5],
				}
				// ISL Trunk, always ID 1
				if (group.id === 0) {
					trunk_values.push({
						name: group.name,
						trunk_id: 1,
						color: group.color,
					})
					if (!this.trunks) {
						variables[`trunk_1_name`] = group.name
						variables[`trunk_1_color`] = group.color
					}
					const new_member_of: MemberOf = {
						id: 1,
						type: 'trunk',
					}
					group.ports.forEach((port_nr) => {
						const port_idx = this.ports.findIndex((p) => p.port_number === port_nr)
						if (
							this.ports[port_idx] &&
							(this.ports[port_idx].member_of.id !== new_member_of.id ||
								this.ports[port_idx].member_of.type !== new_member_of.type)
						) {
							member_of_change = true
							this.ports[port_idx].member_of = new_member_of
							variables[`port_${port_nr}_member_id`] = new_member_of.id
							variables[`port_${port_nr}_member_type`] = new_member_of.type
							variables[`port_${port_nr}_member_name`] = group.name
							variables[`port_${port_nr}_member_color`] = group.color
						}
					})
				} else {
					group_values.push({
						name: group.name,
						group_id: group.id,
						color: group.color,
					})
					const old_group = this.groups?.find((g) => g.group_id === group.id)
					if (!this.groups || !old_group) {
						variables[`group_${group.id}_name`] = group.name
						variables[`group_${group.id}_color`] = group.color
					} else {
						if (old_group.name != group.name) {
							variables[`group_${group.id}_name`] = group.name
						}
						if (old_group.color != group.color) {
							member_of_change = true
							variables[`group_${group.id}_color`] = group.color
						}
					}
					const new_member_of: MemberOf = {
						id: group.id,
						type: 'group',
					}
					group.ports.forEach((port_nr) => {
						const port_idx = this.ports.findIndex((p) => p.port_number === port_nr)
						if (
							this.ports[port_idx] &&
							(this.ports[port_idx].member_of.id !== new_member_of.id ||
								this.ports[port_idx].member_of.type !== new_member_of.type)
						) {
							member_of_change = true
							this.ports[port_idx].member_of = new_member_of
							variables[`port_${port_nr}_member_id`] = new_member_of.id
							variables[`port_${port_nr}_member_type`] = new_member_of.type
							variables[`port_${port_nr}_member_name`] = group.name
							variables[`port_${port_nr}_member_color`] = group.color
						}
					})
				}
			})
			if (!this.groups || this.groups.length !== group_values.length) {
				this.groups = group_values
				this.trunks = trunk_values
				this.instance.initVariables()
				this.instance.initPresets()
			} else {
				this.groups = group_values
				this.trunks = trunk_values
			}
			this.instance.setVariableValues(variables)
			if (member_of_change) {
				this.instance.checkFeedbacks(
					FeedbackId.portColor,
					FeedbackId.selectedPortColor,
					FeedbackId.groupColor,
					FeedbackId.selectedGroupColor,
				)
			}
		} else if (cmd.startsWith('config/lmx')) {
			//
		} else if (cmd.startsWith('config/misc')) {
			//
		} else if (cmd.startsWith('config/icfg_profile_activate')) {
			//
		} else {
			this.log('debug', `Unhandled command ${cmd}: ${JSON.stringify(data)}`)
		}
	}

	public identify(_duration: number): void {
		this.log('debug', 'identify')
		const params = {
			wink: 1,
		}
		this.sendCommand(`config/lmx`, 'POST', params)
	}

	public reboot(wait: number): void {
		setTimeout(() => {
			this.sendCommand(`config/misc`, 'POST', {
				now: 1,
			})
			setTimeout(() => this.disconnect(`Reboot triggered`), 500)
		}, wait)
	}

	public reset(keep_ip: boolean, keep_profiles: boolean, wait: number): void {
		const params: any = {}
		if (keep_ip) {
			params['factory'] = 'yes'
		} else {
			params['factory_full'] = 'yes'
		}
		if (!keep_profiles) {
			params['clear_profiles'] = 'yes'
		}
		setTimeout(() => {
			this.sendCommand(`config/misc`, 'POST', params)
			setTimeout(() => this.disconnect(`Reset triggered`), 500)
		}, wait)
	}

	public recallProfile(profile: number, keep_ip: boolean, wait: number): void {
		if (this.getProfileEmpty(profile)) {
			this.log('info', `Profile ${profile} is empty and cannot be recalled`)
			return
		}
		const params: any = {}
		params['slot_name'] = 'Slot' + profile.toString(16).toUpperCase()
		if (keep_ip) {
			params['keep_ip'] = 1
		}
		setTimeout(() => {
			this.sendCommand(`config/icfg_profile_activate`, 'POST', params)
			setTimeout(() => this.disconnect(`Profile recall triggered`), 500)
		}, wait)
	}

	public saveProfile(profile: number, name: string): void {
		if (this.getProfileProtected(profile)) {
			this.log('info', `Profile ${profile} is protected and cannot be overwritten`)
			return
		}
		const params: any = {}
		params['slot_name'] = 'Slot' + profile.toString(16).toUpperCase()
		params['profile_name'] = name
		this.sendCommand(`config/icfg_profile_save`, 'POST', params)
	}

	public setPortToGroup(port_nr: number, group_id: number): void {
		if (this.getPortProtected(port_nr)) {
			this.log('info', `Port ${port_nr} is protected and cannot be changed`)
			return
		}
		this.log('info', `Changing group of port ${port_nr} to ${group_id}`)
		this.sendCommand(`config/group_port?port=${port_nr}&group=${group_id}`, 'GET')
		this.sendCommand(`config/groups`, 'GET')
	}

	public setPortToTrunk(port_nr: number, trunk_id: number): void {
		if (trunk_id !== 1) {
			this.log(
				'info',
				`Only 1 can be used as the trunk_id since this GigaCore only has 1 trunk (ISL). ${trunk_id} is invalid`,
			)
			return
		}
		if (this.getPortProtected(port_nr)) {
			this.log('info', `Port ${port_nr} is protected and cannot be changed`)
			return
		}
		this.log('info', `Changing trunk of port ${port_nr} to ${trunk_id}`)
		this.sendCommand(`config/group_port?port=${port_nr}&group=0`, 'GET')
		this.sendCommand(`config/groups`, 'GET')
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
		if (port.member_of.type !== 'group') {
			// check ISL: cannot be incremented
			this.log('info', `Port ${port_nr} is a ISL port and cannot be changed to a group`)
			return
		}
		const old_group_id = port.member_of.id
		const new_group_id = old_group_id >= 20 ? 1 : old_group_id + 1
		this.log('info', `Changing group of port ${port_nr} to ${new_group_id}`)
		this.sendCommand(`config/group_port?port=${port_nr}&group=${new_group_id}`, 'GET')
		this.sendCommand(`config/groups`, 'GET')
	}

	public setPortPoe(port_nr: number, enabled: boolean): void {
		if (this.getPortProtected(port_nr)) {
			this.log('info', `Port ${port_nr} is protected and cannot be changed`)
			return
		}
		if (!this.poe_capable) {
			this.log('debug', 'This device is not PoE capable')
			return
		}
		let mode = 0
		if (enabled) {
			// Set to PoE mode plus
			mode = 2
		}
		const params: any = {}
		params[`hidden_portno_${port_nr}`] = port_nr
		params[`hidden_poe_mode_${port_nr}`] = mode
		this.sendCommand(`config/poe_config`, 'POST', params)
		// If disabling, reset sourcing immediately
		const variables: CompanionVariableValues = {}
		if (enabled === false) {
			const port = this.poe_ports.findIndex((p) => p.port_number === port_nr)
			this.poe_ports[port].sourcing = false
			this.poe_ports[port].enabled = false
			this.instance.checkFeedbacks(FeedbackId.poeEnabled, FeedbackId.poeSourcing)
			variables[`port_${port_nr}_poe_sourcing`] = false
		}
		variables[`port_${port_nr}_poe_enabled`] = enabled
		this.instance.setVariableValues(variables)
	}

	public setPortLink(port_nr: number, enabled: boolean): void {
		if (this.getPortProtected(port_nr)) {
			this.log('info', `Port ${port_nr} is protected and cannot be changed`)
			return
		}
		this.log('debug', `new Speed for ${port_nr} to state ${enabled}`)
		let speed = '0A0A0A0A0'
		if (enabled) {
			// Set to speed auto
			// Dual media ports on 26i have different auto speed setting
			if (this.nr_ports === 26 && port_nr > 20 && port_nr < 25) {
				speed = '1A1A0A0A4'
			} else {
				speed = '1A1A0A0A0'
			}
		}
		const params: any = {}
		params[`speed_${port_nr}`] = speed
		this.log('debug', `new Speed for ${port_nr} is ${speed}`)
		this.sendCommand(`config/ports`, 'POST', params)
		this.sendCommand(`config/ports`, 'GET')
	}
}
