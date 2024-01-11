import { Device } from './device.js'
import * as Color from './colors.js'
import * as Icon from './icons.js'
import {
	type CompanionFeedbackDefinition,
	type CompanionFeedbackDefinitions,
	type CompanionAdvancedFeedbackResult,
} from '@companion-module/base'

export enum FeedbackId {
	poeEnabled = 'poe_enabled',
	poeSourcing = 'poe_sourcing',
	portState = 'port_state',
	portDisabled = 'port_disabled',
	portColor = 'port_color',
	groupColor = 'group_color',
	selectedPortColor = 'selected_port_color',
	selectedGroupColor = 'selected_group_color',
	portProtected = 'port_protected',
	selectedPortProtected = 'selected_port_protected',
	profileProtected = 'profile_protected',
}

export function getFeedbacks(device: Device): CompanionFeedbackDefinitions {
	const feedbacks: { [id: string]: CompanionFeedbackDefinition | undefined } = {}
	const max_ports = device.nr_ports

	if (device.poe_capable) {
		feedbacks[FeedbackId.poeEnabled] = {
			type: 'boolean',
			name: 'PoE Enabled',
			description: 'Change style based on PoE port state',
			defaultStyle: {
				color: Color.Green,
			},
			options: [
				{
					type: 'number',
					label: 'Port',
					id: 'port_nr',
					default: 1,
					min: 1,
					max: max_ports,
				},
			],
			callback: (feedback): boolean => {
				const port_nr = Number(feedback.options.port_nr)
				if (!device.poe_ports) {
					return false
				}
				const port = device.poe_ports.find((p) => p.port_number === port_nr)
				if (port && port.enabled) {
					return port.enabled
				}
				return false
			},
		}

		feedbacks[FeedbackId.poeSourcing] = {
			type: 'boolean',
			name: 'PoE Sourcing',
			description: 'Change style based on PoE port power delivery',
			defaultStyle: {
				color: Color.Green,
			},
			options: [
				{
					type: 'number',
					label: 'Port',
					id: 'port_nr',
					default: 1,
					min: 1,
					max: max_ports,
				},
			],
			callback: (feedback): boolean => {
				const port_nr = feedback.options.port_nr
				if (!device.poe_ports) {
					return false
				}
				const port = device.poe_ports.find((p) => p.port_number === port_nr)
				if (port && port.sourcing) {
					return true
				}
				return false
			},
		}
	}

	feedbacks[FeedbackId.portState] = {
		type: 'boolean',
		name: 'Link State',
		description: 'Change style if port has active link',
		defaultStyle: {
			color: Color.Green,
		},
		options: [
			{
				type: 'number',
				label: 'Port',
				id: 'port_nr',
				default: 1,
				min: 1,
				max: max_ports,
			},
		],
		callback: (feedback): boolean => {
			const port_nr = feedback.options.port_nr
			const ports = device.ports
			if (!ports) {
				return false
			}
			const port = device.ports.find((p) => p.port_number === port_nr)
			if (port && port.link_up) {
				return port.link_up
			}
			return false
		},
	}

	feedbacks[FeedbackId.portDisabled] = {
		type: 'boolean',
		name: 'Port Disabled',
		description: 'Change style if port is disabled',
		defaultStyle: {
			color: Color.Grey,
		},
		options: [
			{
				type: 'number',
				label: 'Port',
				id: 'port_nr',
				default: 1,
				min: 1,
				max: max_ports,
			},
		],
		callback: (feedback): boolean => {
			const port_nr = feedback.options.port_nr
			const ports = device.ports
			if (!ports) {
				return false
			}
			const port = device.ports.find((p) => p.port_number === port_nr)
			if (port && port.enabled === false) {
				return port.enabled === false
			}
			return false
		},
	}

	feedbacks[FeedbackId.portColor] = {
		type: 'advanced',
		name: 'Port Color',
		description: 'Change style based on the group or trunk color of the port',
		options: [
			{
				type: 'number',
				label: 'Port',
				id: 'port_nr',
				default: 1,
				min: 1,
				max: max_ports,
			},
		],
		callback: (feedback): CompanionAdvancedFeedbackResult => {
			const port_nr = Number(feedback.options.port_nr)
			const groups = device.groups
			if (!groups) {
				return {}
			}
			const color = device.getPortColor(port_nr)
			if (color) {
				return { bgcolor: Color.hexToColor(color) }
			} else {
				return {}
			}
		},
	}

	feedbacks[FeedbackId.groupColor] = {
		type: 'advanced',
		name: 'Group Color',
		description: 'Change style based on the color of a group',
		options: [
			{
				type: 'number',
				label: 'Group',
				id: 'id',
				default: 1,
				min: 1,
				max: device.getMaxGroups(),
			},
		],
		callback: (feedback): CompanionAdvancedFeedbackResult => {
			const groups = device.groups
			if (!groups) {
				return {}
			}
			const group = groups.find((g) => g.group_id === feedback.options.id)
			if (group) {
				return { bgcolor: Color.hexToColor(group.color) }
			} else {
				return {}
			}
		},
	}

	feedbacks[FeedbackId.selectedPortColor] = {
		type: 'advanced',
		name: 'Selected Port Color',
		description: 'Change style based on the group or trunk color of the selected port',
		options: [],
		callback: (): CompanionAdvancedFeedbackResult => {
			const port_nr = Number(device.getVariableValue(`selected_port`))
			if (Number.isNaN(port_nr)) {
				return {}
			}
			const color = device.getPortColor(port_nr)
			if (color) {
				return { bgcolor: Color.hexToColor(color) }
			} else {
				return {}
			}
		},
	}

	feedbacks[FeedbackId.selectedGroupColor] = {
		type: 'advanced',
		name: 'Selected Group Color',
		description: 'Change style based on the color of the selected group',
		options: [],
		callback: (): CompanionAdvancedFeedbackResult => {
			const group_id = Number(device.getVariableValue(`selected_group`))
			if (Number.isNaN(group_id)) {
				return {}
			}
			const groups = device.groups
			if (!groups) {
				return {}
			}
			const group = groups.find((g) => g.group_id === group_id)
			if (group) {
				return { bgcolor: Color.hexToColor(group.color) }
			} else {
				return {}
			}
		},
	}

	feedbacks[FeedbackId.portProtected] = {
		type: 'advanced',
		name: 'Port Protected',
		description: 'Change style if a port is locked / protected',
		options: [
			{
				type: 'number',
				label: 'Port',
				id: 'port_nr',
				default: 1,
				min: 1,
				max: max_ports,
			},
		],
		callback: (feedback): CompanionAdvancedFeedbackResult => {
			const port_nr = Number(feedback.options.port_nr)
			if (device.getPortProtected(port_nr)) {
				return {
					png64: Icon.LOCK_ICON,
					pngalignment: 'center:center',
				}
			} else {
				return {}
			}
		},
	}

	feedbacks[FeedbackId.selectedPortProtected] = {
		type: 'boolean',
		name: 'Selected Port Protected',
		description: 'Change style if the selected port is locked / protected',
		defaultStyle: {
			color: Color.Red,
		},
		options: [],
		callback: (): boolean => {
			const port_nr = Number(device.getVariableValue(`selected_port`))
			return device.getPortProtected(port_nr)
		},
	}

	feedbacks[FeedbackId.profileProtected] = {
		type: 'advanced',
		name: 'Profile Protected',
		description: 'Change style if a profile is locked / protected',
		options: [
			{
				type: 'number',
				label: 'Profile',
				id: 'profile',
				default: 1,
				min: 1,
				max: device.getNrProfiles(),
			},
		],
		callback: (feedback): CompanionAdvancedFeedbackResult => {
			const profile = Number(feedback.options.profile)
			if (device.getProfileProtected(profile)) {
				return {
					png64: Icon.LOCK_ICON,
					pngalignment: 'center:center',
				}
			} else {
				return {}
			}
		},
	}

	return feedbacks
}
