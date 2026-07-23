import ModuleInstance from './main.js'
import { InstanceStatus, type CompanionVariableValue } from '@companion-module/base'
import {
	Agent,
	fetch as undiciFetch,
	type RequestInit as UndiciRequestInit,
	type Response as UndiciResponse,
} from 'undici'

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

export interface Profile {
	id: number
	name: string
	empty: boolean
	protected: boolean
}

export abstract class Device {
	host = ''
	password = ''
	instance: ModuleInstance

	/** Transport scheme in use for this device. Determined at connect time (see Gen2). */
	protected protocol: 'http' | 'https' = 'http'

	/**
	 * Shared dispatcher used for HTTPS requests. GigaCore devices may present a self-signed
	 * certificate, so certificate validation is disabled for device connections.
	 */
	private static insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } })

	connected = false

	nr_ports = 0
	poe_capable = false
	ports: Port[] = []
	poe_ports: PoePort[] = []
	groups: Group[] = []
	trunks: Trunk[] = []
	profiles: Profile[] = []

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

	/** Basic auth header for the device, or undefined when no password is set. */
	protected authHeader(): string | undefined {
		if (this.password === '') return undefined
		return `Basic ${Buffer.from(`admin:${this.password}`).toString('base64')}`
	}

	/** Base HTTP(S) URL for the device, using the currently detected scheme. */
	protected get httpBase(): string {
		return `${this.protocol}://${this.host}`
	}

	/** Whether the WebSocket should connect over TLS (wss), matching the detected scheme. */
	public get secure(): boolean {
		return this.protocol === 'https'
	}

	/**
	 * fetch wrapper for device requests. For HTTPS URLs it injects the insecure dispatcher so
	 * self-signed device certificates are accepted.
	 *
	 * We deliberately use undici's own fetch + Agent rather than Node's global fetch: the
	 * standalone undici version differs from the one bundled with Node, and feeding a standalone
	 * Agent into the global fetch is unreliable across versions. Using the matched pair keeps the
	 * dispatcher (which disables certificate validation) reliably honoured.
	 */
	protected async deviceFetch(url: string, options: UndiciRequestInit): Promise<UndiciResponse> {
		const opts: UndiciRequestInit = { ...options }
		if (url.startsWith('https:')) {
			opts.dispatcher = Device.insecureDispatcher
		}
		return undiciFetch(url, opts)
	}

	/** Extract a human-readable message from a thrown error, including undici's `cause`. */
	protected errorMessage(error: unknown): string {
		if (error instanceof Error) {
			const cause = (error as { cause?: unknown }).cause
			if (cause instanceof Error) {
				return `${error.message} (${cause.message})`
			}
			if (cause && typeof cause === 'object' && 'code' in cause) {
				return `${error.message} (${String((cause as { code: unknown }).code)})`
			}
			return error.message
		}
		return String(error)
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

	getProfile(id: number): Profile | undefined {
		if (!this.profiles) {
			return undefined
		}
		return this.profiles.find((p) => p.id === id)
	}

	public getProfileProtected(id: number): boolean {
		const profile = this.getProfile(id)
		if (!profile) {
			return false
		}
		return profile.protected
	}

	public getProfileEmpty(id: number): boolean {
		const profile = this.getProfile(id)
		if (!profile) {
			return true
		}
		return profile.empty
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
	public abstract saveProfile(profile: number, name: string): void
	public abstract setPortToGroup(port_nr: number, group_id: number): void
	public abstract setPortToTrunk(port_nr: number, trunk_id: number): void
	public abstract incrementMemberOf(port_nr: number): void
	public abstract setPortPoe(port_nr: number, enabled: boolean): void
	public abstract setPortLink(port_nr: number, enabled: boolean): void
}
