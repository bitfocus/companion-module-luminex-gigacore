import { ModuleInstance } from './main.js'
import { InstanceStatus, type CompanionVariableValue } from '@companion-module/base'

export interface MemberOf {
	id: number
	type: 'none' | 'group' | 'trunk'
}

export interface Port {
	port_number: number
	enabled: boolean
	legend: string
	protected: boolean
	link_up: boolean
	member_of: MemberOf
}

export interface PoePort {
	port_number: number
	enabled: boolean
	sourcing: boolean
}

export interface Group {
	group_id: number
	name: string
	color: string
}

export interface Trunk {
	trunk_id: number
	name: string
	color: string
}

export abstract class Device {
	host = ''
	password = ''
	instance: ModuleInstance

	connected = false

	nr_ports = 0
	poe_capable = false
	ports: Port[] = []
	poe_ports: PoePort[] = []
	groups: Group[] = []
	trunks: Trunk[] = []

	constructor(instance: ModuleInstance) {
		this.instance = instance
	}

	public abstract destroy(): Promise<void>

	updateStatus(status: InstanceStatus, msg: string | null = null): void {
		this.connected = status === InstanceStatus.Ok
		this.instance.updateStatus(status, msg)
	}

	log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
		this.instance.log(level, message)
	}

	public getVariableValue(variable: string): undefined | CompanionVariableValue {
		return this.instance.getVariableValue(variable)
	}

	public setConfig(host: string, password: string): void {
		this.host = host
		this.password = password
	}

	public getNrPorts(): number {
		return this.nr_ports
	}

	public getPortProtected(port_nr: number): boolean {
		if (!this.ports) {
			return false
		}
		const port = this.ports.find((p) => p.port_number === port_nr)
		if (!port) {
			return false
		}
		return port.protected
	}

	getMemberOfNameAndColor(member_of: MemberOf): { color: string; name: string } | undefined {
		if (!member_of) {
			return undefined
		} else if (member_of.type === 'group') {
			if (!this.groups) {
				return undefined
			}
			const group = this.groups.find((g) => g.group_id === member_of.id)
			if (group) {
				return {
					color: group.color,
					name: group.name,
				}
			}
		} else if (member_of.type === 'trunk') {
			if (!this.trunks) {
				return undefined
			}
			const trunk = this.trunks.find((g) => g.trunk_id === member_of.id)
			if (trunk) {
				return {
					color: trunk.color,
					name: trunk.name,
				}
			}
		}
		return undefined
	}

	getPortColor(port_nr: number): string | undefined {
		if (!this.ports) {
			return undefined
		}
		const port = this.ports.find((p) => p.port_number === port_nr)
		if (!port) {
			return undefined
		}
		const res = this.getMemberOfNameAndColor(port.member_of)
		if (res && 'color' in res) {
			return res.color
		}
		return undefined
	}

	public abstract initConnection(): void
	public abstract disconnect(msg: string): void

	public abstract getNrProfiles(): number
	public abstract getMaxGroups(): number
	public abstract getMaxTrunks(): number

	public abstract identify(duration: number): void
	public abstract reboot(wait: number): void
	public abstract reset(keep_ip: boolean, keep_profiles: boolean, wait: number): void
	public abstract recallProfile(profile: number, keep_ip: boolean, wait: number): void
	public abstract setPortToGroup(port_nr: number, group_id: number): void
	public abstract setPortToTrunk(port_nr: number, trunk_id: number): void
	public abstract incrementMemberOf(port_nr: number): void
	public abstract setPortPoe(port_nr: number, enabled: boolean): void
	public abstract setPortLink(port_nr: number, enabled: boolean): void
}
