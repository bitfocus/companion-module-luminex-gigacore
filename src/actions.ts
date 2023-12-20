import type { CompanionActionDefinition } from '@companion-module/base'
import { Device } from './device.js'
import { FeedbackId } from './feedbacks.js'
import { type CompanionVariableValues } from '@companion-module/base'

type CompanionActionsExt = { [id in ActionId]: CompanionActionDefinition | undefined }

export enum ActionId {
	Identify = 'identify',
	Reboot = 'reboot',
	Reset = 'reset',
	RecallProfile = 'recall_profile',
	SetPortToGroup = 'set_port_to_group',
	SetPortToTrunk = 'set_port_to_trunk',
	IncrementPortGroupOrTrunk = 'increment_port_group_or_trunk',
	TogglePoe = 'toggle_poe',
	ToggleLink = 'toggle_link',
	SetPortToGroupWithVariables = 'set_port_to_group_variables',
	SetVariable = 'set_variable',
}

export function getActions(device: Device): CompanionActionsExt {
	const toggleChoices = [
		{ id: 'toggle', label: 'Toggle' },
		{ id: 'true', label: 'Enable' },
		{ id: 'false', label: 'Disable' },
	]
	const max_ports = device.nr_ports

	const actions: { [id in ActionId]: CompanionActionDefinition | undefined } = {
		[ActionId.Identify]: {
			name: 'Identify',
			options: [
				{
					id: 'duration',
					type: 'number',
					label: 'Identify duration (seconds)',
					default: 9,
					min: 0,
					max: 30000,
				},
			],
			callback: (action) => {
				const duration = action.options.duration ? Number(action.options.duration) : 9
				device.identify(duration)
			},
		} satisfies CompanionActionDefinition,
		[ActionId.Reboot]: {
			name: 'Reboot',
			options: [
				{
					id: 'wait',
					type: 'number',
					label: 'Reboot delay (milliseconds)',
					default: 0,
					min: 0,
					max: 30000,
				},
			],
			callback: (action) => {
				const wait = action.options.wait ? Number(action.options.wait) : 0
				device.reboot(wait)
			},
		} satisfies CompanionActionDefinition,
		[ActionId.Reset]: {
			name: 'Reset',
			options: [
				{
					id: 'keep_ip_settings',
					type: 'checkbox',
					label: 'Keep IP Settings',
					default: true,
				},
				{
					id: 'keep_user_profiles',
					type: 'checkbox',
					label: 'Keep User Profiles',
					default: true,
				},
				{
					id: 'wait',
					type: 'number',
					label: 'Reboot delay (milliseconds)',
					default: 0,
					min: 0,
					max: 30000,
				},
			],
			callback: (action) => {
				const wait = action.options.wait ? Number(action.options.wait) : 0
				const keep_ip = action.options.keep_ip_settings !== undefined ? Boolean(action.options.keep_ip_settings) : true
				const keep_profiles =
					action.options.keep_user_profiles !== undefined ? Boolean(action.options.keep_user_profiles) : true
				device.reset(keep_ip, keep_profiles, wait)
			},
		} satisfies CompanionActionDefinition,
		[ActionId.RecallProfile]: {
			name: 'Recall configuration from profile',
			options: [
				{
					type: 'number',
					label: 'Profile',
					id: 'profile',
					tooltip: '1-based profile number',
					default: 1,
					min: 1,
					max: device.getNrProfiles(),
				},
				{
					id: 'keep_ip_settings',
					type: 'checkbox',
					label: 'Keep Ip Settings',
					default: true,
				},
				{
					id: 'wait',
					type: 'number',
					label: 'Reboot delay (milliseconds)',
					default: 0,
					min: 0,
					max: 30000,
				},
			],
			callback: (action) => {
				const wait = action.options.wait ? Number(action.options.wait) : 0
				const profile = Number(action.options.profile)
				const keep_ip = action.options.keep_ip_settings !== undefined ? Boolean(action.options.keep_ip_settings) : true
				device.recallProfile(profile, keep_ip, wait)
			},
		} satisfies CompanionActionDefinition,
		[ActionId.SetPortToGroup]: {
			name: 'Change the group of a port',
			options: [
				{
					type: 'number',
					label: 'port',
					id: 'port',
					tooltip: '1-based port number',
					default: 1,
					min: 1,
					max: max_ports,
				},
				{
					id: 'group',
					type: 'number',
					label: 'Group ID',
					default: 1,
					min: 1,
					max: device.getMaxGroups(),
				},
			],
			callback: (action) => {
				const port_nr = Number(action.options.port)
				const group_id = Number(action.options.group)
				device.setPortToGroup(port_nr, group_id)
			},
		} satisfies CompanionActionDefinition,

		[ActionId.SetPortToTrunk]: {
			name: 'Set a port to be a member of a trunk',
			options: [
				{
					type: 'number',
					label: 'port',
					id: 'port',
					tooltip: '1-based port number',
					default: 1,
					min: 1,
					max: max_ports,
				},
				{
					id: 'trunk',
					type: 'number',
					label: 'Trunk ID',
					default: 1,
					min: 1,
					max: device.getMaxTrunks(),
				},
			],
			callback: (action) => {
				const port_nr = Number(action.options.port)
				const trunk_id = Number(action.options.trunk)
				device.setPortToTrunk(port_nr, trunk_id)
			},
		} satisfies CompanionActionDefinition,

		[ActionId.SetPortToGroupWithVariables]: {
			name: 'Change the group of a port based on variable values',
			description:
				'The port from variable $(gigacore:selected_port) will be assigned to group $(gigacore:selected_group)',
			options: [],
			callback: () => {
				const port_nr = Number(device.getVariableValue(`selected_port`))
				const group_id = Number(device.getVariableValue(`selected_group`))
				device.setPortToGroup(port_nr, group_id)
			},
		} satisfies CompanionActionDefinition,

		[ActionId.SetVariable]: {
			name: "Change the value of one of the internal 'select' variables",
			options: [
				{
					id: 'variable',
					type: 'dropdown',
					label: 'Variable',
					default: 'selected_port',
					choices: [
						{ id: 'selected_port', label: 'Selected Port' },
						{ id: 'selected_group', label: 'Selected Group' },
					],
				},
				{
					id: 'expression',
					type: 'textinput',
					label: 'Expression',
					default: '$(gigacore:selected_group) + 1',
					useVariables: true,
				},
			],
			callback: (action) => {
				if (action.options.expression === undefined || action.options.variable === undefined) {
					return
				}
				const variable = action.options.variable
				device.instance
					.parseVariablesInString(action.options.expression.toString())
					.then((expression) => {
						const value = eval(expression)
						if (variable !== undefined && !Number.isNaN(value)) {
							const changedVariables: CompanionVariableValues = {}
							changedVariables[`${variable}`] = value
							device.instance.setVariableValues(changedVariables)
							if (variable === 'selected_port') {
								device.instance.checkFeedbacks(FeedbackId.selectedPortColor, FeedbackId.selectedPortProtected)
							} else if (variable === 'selected_group') {
								device.instance.checkFeedbacks(FeedbackId.selectedGroupColor)
							}
						}
					})
					.catch((e) => {
						device.log('debug', `Failed to change ${variable}: ${e.toString()}`)
					})
			},
		} satisfies CompanionActionDefinition,

		[ActionId.IncrementPortGroupOrTrunk]: {
			name: 'Increment the group or trunk of a port',
			options: [
				{
					type: 'number',
					label: 'port',
					id: 'port',
					tooltip: '1-based port number',
					default: 1,
					min: 1,
					max: max_ports,
				},
			],
			callback: (action) => {
				const port_nr = Number(action.options.port)
				device.incrementMemberOf(port_nr)
			},
		} satisfies CompanionActionDefinition,

		[ActionId.TogglePoe]: {
			name: 'Toggle PoE on a port',
			options: [
				{
					id: 'port_nr',
					type: 'number',
					label: 'Port number',
					default: 1,
					min: 1,
					max: max_ports,
				},
				{
					id: 'enabled',
					type: 'dropdown',
					label: 'PoE',
					default: 'true',
					choices: toggleChoices,
				},
			],
			callback: (action) => {
				const port_nr = Number(action.options.port_nr)
				if (!device.poe_capable) {
					device.log('debug', 'this device is not PoE capable')
					return
				}
				let state
				if (action.options.enabled === 'toggle') {
					const poe_ports = device.poe_ports
					if (!poe_ports) {
						return
					}
					const port = poe_ports.find((p) => p.port_number === port_nr)
					if (!port) {
						device.log('debug', `PoE is not supported on port ${port_nr}`)
						return
					}
					const enabled = port.enabled
					state = enabled === true ? false : true
				} else {
					state = action.options.enabled === 'true'
				}
				device.setPortPoe(port_nr, state)
			},
		} satisfies CompanionActionDefinition,
		[ActionId.ToggleLink]: {
			name: 'Toggle Link on a port',
			options: [
				{
					id: 'port_nr',
					type: 'number',
					label: 'Port number',
					default: 1,
					min: 1,
					max: max_ports,
				},
				{
					id: 'enabled',
					type: 'dropdown',
					label: 'Link',
					default: 'true',
					choices: toggleChoices,
				},
			],
			callback: (action) => {
				const port_nr = Number(action.options.port_nr)
				let state
				if (action.options.enabled === 'toggle') {
					const ports = device.ports
					if (!ports) {
						device.log('debug', 'Ports not initialized yet')
						return
					}
					const port = ports.find((p) => p.port_number === port_nr)
					if (!port) {
						device.log('debug', `Port ${port} not found`)
						return
					}
					state = port.enabled === true ? false : true
				} else {
					state = action.options.enabled === 'true'
				}
				device.setPortLink(port_nr, state)
			},
		} satisfies CompanionActionDefinition,
	}

	return actions
}
