import { Device } from './device.js'
import type { CompanionVariableDefinition } from '@companion-module/base'

export enum FixedVariableId {
	deviceName = 'device_name',
	serial = 'serial',
	description = 'description',
	macAddress = 'mac_address',
	model = 'model',
	activeProfile = 'active_profile',
	nrPorts = 'nr_ports',
	poeCapable = 'poe_capable',
}

export function getVariables(device: Device): CompanionVariableDefinition[] {
	const variables = []

	variables.push({
		variableId: 'device_name',
		name: 'Device Name',
	})

	variables.push({
		variableId: 'serial',
		name: 'Serial Number',
	})

	variables.push({
		variableId: 'description',
		name: 'Description',
	})

	variables.push({
		variableId: 'mac_address',
		name: 'MAC address',
	})

	variables.push({
		variableId: 'model',
		name: 'Model',
	})

	variables.push({
		variableId: 'active_profile',
		name: 'Active Profile',
	})

	variables.push({
		variableId: 'nr_ports',
		name: 'Number of ports',
	})

	variables.push({
		variableId: 'poe_capable',
		name: 'PoE Support',
	})

	Array(device.getNrProfiles())
		.fill(0)
		.forEach((_, i) => {
			const id = i + 1
			variables.push({
				name: `Profile ${id} name`,
				variableId: `profile_${id}_name`,
			})
		})

	if (device.groups) {
		device.groups.forEach((group) => {
			const id = group.group_id
			variables.push({
				name: `Group ${id} name`,
				variableId: `group_${id}_name`,
			})
			variables.push({
				name: `Group ${id} color`,
				variableId: `group_${id}_color`,
			})
		})
	}

	if (device.trunks) {
		device.trunks.forEach((trunk) => {
			const id = trunk.trunk_id
			variables.push({
				name: `Trunk ${id} name`,
				variableId: `trunk_${id}_name`,
			})
			variables.push({
				name: `Trunk ${id} color`,
				variableId: `trunk_${id}_color`,
			})
		})
	}

	if (device.nr_ports) {
		device.ports.forEach((p) => {
			const id = p.port_number
			variables.push({
				name: `Port ${id} Legend`,
				variableId: `port_${id}_legend`,
			})
			variables.push({
				name: `Port ${id} Enabled`,
				variableId: `port_${id}_enabled`,
			})
			variables.push({
				name: `Port ${id} Link Up`,
				variableId: `port_${id}_up`,
			})
			variables.push({
				name: `Port ${id} Protected`,
				variableId: `port_${id}_protected`,
			})
			variables.push({
				name: `Port ${id} Member ID`,
				variableId: `port_${id}_member_id`,
			})
			variables.push({
				name: `Port ${id} Member Type`,
				variableId: `port_${id}_member_type`,
			})
			variables.push({
				name: `Port ${id} Member Name`,
				variableId: `port_${id}_member_name`,
			})
			variables.push({
				name: `Port ${id} Member Color`,
				variableId: `port_${id}_member_color`,
			})
		})
	}

	if (device.poe_ports && device.poe_capable) {
		device.poe_ports.forEach((port) => {
			const id = port.port_number
			variables.push({
				name: `Port ${id} PoE enabled`,
				variableId: `port_${id}_poe_enabled`,
			})
			variables.push({
				name: `Port ${id} PoE sourcing`,
				variableId: `port_${id}_poe_sourcing`,
			})
		})
	}

	variables.push({
		variableId: 'selected_port',
		name: 'Selected Port',
	})

	variables.push({
		variableId: 'selected_group',
		name: 'Selected Group',
	})

	return variables
}
