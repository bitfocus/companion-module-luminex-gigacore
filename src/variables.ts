import { Device } from './device.js'
import type { CompanionVariableDefinitions } from '@companion-module/base'

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

export function getVariables(device: Device): CompanionVariableDefinitions<any> {
	const variables: CompanionVariableDefinitions<any> = {}

	variables[FixedVariableId.deviceName] = {
		name: 'Device Name',
	}

	variables[FixedVariableId.serial] = {
		name: 'Serial Number',
	}

	variables[FixedVariableId.description] = {
		name: 'Description',
	}

	variables[FixedVariableId.macAddress] = {
		name: 'MAC address',
	}

	variables[FixedVariableId.model] = {
		name: 'Model',
	}

	variables[FixedVariableId.activeProfile] = {
		name: 'Active Profile',
	}

	variables[FixedVariableId.nrPorts] = {
		name: 'Number of ports',
	}

	variables[FixedVariableId.poeCapable] = {
		name: 'PoE Support',
	}

	Array(device.getNrProfiles())
		.fill(0)
		.forEach((_, i) => {
			const id = i + 1
			variables[`profile_${id}_name`] = {
				name: `Profile ${id} name`,
			}
		})

	if (device.groups) {
		device.groups.forEach((group) => {
			const id = group.group_id
			variables[`group_${id}_name`] = {
				name: `Group ${id} name`,
			}
			variables[`group_${id}_color`] = {
				name: `Group ${id} color`,
			}
		})
	}

	if (device.trunks) {
		device.trunks.forEach((trunk) => {
			const id = trunk.trunk_id
			variables[`trunk_${id}_name`] = {
				name: `Trunk ${id} name`,
			}
			variables[`trunk_${id}_color`] = {
				name: `Trunk ${id} color`,
			}
		})
	}

	if (device.nr_ports) {
		device.ports.forEach((p) => {
			const id = p.port_number
			variables[`port_${id}_legend`] = {
				name: `Port ${id} Legend`,
			}
			variables[`port_${id}_enabled`] = {
				name: `Port ${id} Enabled`,
			}
			variables[`port_${id}_up`] = {
				name: `Port ${id} Link Up`,
			}
			variables[`port_${id}_protected`] = {
				name: `Port ${id} Protected`,
			}
			variables[`port_${id}_member_id`] = {
				name: `Port ${id} Member ID`,
			}
			variables[`port_${id}_member_type`] = {
				name: `Port ${id} Member Type`,
			}
			variables[`port_${id}_member_name`] = {
				name: `Port ${id} Member Name`,
			}
			variables[`port_${id}_member_color`] = {
				name: `Port ${id} Member Color`,
			}
		})
	}

	if (device.poe_ports && device.poe_capable) {
		device.poe_ports.forEach((port) => {
			const id = port.port_number
			variables[`port_${id}_poe_enabled`] = {
				name: `Port ${id} PoE enabled`,
			}
			variables[`port_${id}_poe_sourcing`] = {
				name: `Port ${id} PoE sourcing`,
			}
		})
	}

	variables['selected_port'] = {
		name: 'Selected Port',
	}

	variables['selected_group'] = {
		name: 'Selected Group',
	}

	return variables
}
