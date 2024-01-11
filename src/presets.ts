import { Device } from './device.js'
import * as Color from './colors.js'
import { ActionId } from './actions.js'
import { FeedbackId } from './feedbacks.js'
import { type CompanionButtonPresetDefinition, type CompanionPresetDefinitions } from '@companion-module/base'

interface CompanionPresetExt extends CompanionButtonPresetDefinition {
	feedbacks: Array<
		{
			feedbackId: FeedbackId
		} & CompanionButtonPresetDefinition['feedbacks'][0]
	>
	steps: Array<{
		down: Array<
			{
				actionId: ActionId
			} & CompanionButtonPresetDefinition['steps'][0]['down'][0]
		>
		up: Array<
			{
				actionId: ActionId
			} & CompanionButtonPresetDefinition['steps'][0]['up'][0]
		>
	}>
}
interface CompanionPresetDefinitionsExt {
	[id: string]: CompanionPresetExt | undefined
}

export function getPresets(device: Device): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitionsExt = {}

	presets[`device`] = {
		type: 'button',
		category: 'Device',
		name: `Device name and Active Profile Name\n`,
		style: {
			text: `$(GigaCore:device_name)\n$(GigaCore:active_profile)`,
			size: 10,
			color: Color.White,
			bgcolor: Color.Black,
		},
		steps: [
			{
				down: [
					{
						actionId: ActionId.Identify,
						options: {
							duration: 9,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets[`reboot`] = {
		type: 'button',
		category: 'Device',
		name: `Reboot device`,
		style: {
			text: `Reboot\n$(GigaCore:device_name)`,
			size: 10,
			color: Color.White,
			bgcolor: Color.Black,
		},
		steps: [
			{
				down: [
					{
						actionId: ActionId.Reboot,
						options: {
							wait: 0,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets[`reset`] = {
		type: 'button',
		category: 'Device',
		name: `Reset device`,
		style: {
			text: `Reset\n$(GigaCore:device_name)`,
			size: 10,
			color: Color.White,
			bgcolor: Color.Black,
		},
		steps: [
			{
				down: [
					{
						actionId: ActionId.Reset,
						options: {
							keep_ip_settings: true,
							keep_user_profiles: true,
							wait: 100,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets[`active_profile`] = {
		type: 'button',
		category: 'Profiles',
		name: `Active Profile Name\nEmpty if no profile active`,
		style: {
			text: `$(GigaCore:active_profile)`,
			size: 'auto',
			color: Color.LightGreen,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: ActionId.Identify,
						options: {
							duration: 9,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	Array(device.getNrProfiles())
		.fill(0)
		.forEach((_, i) => {
			const id = i + 1
			presets[`recall_profile_${id}`] = {
				type: 'button',
				category: 'Profiles',
				name: `Profile ${id} name\nIncludes Name`,
				style: {
					text: `Recall $(GigaCore:profile_${id}_name)`,
					size: 'auto',
					color: Color.LightBlue,
					bgcolor: 0,
				},
				steps: [
					{
						down: [
							{
								actionId: ActionId.RecallProfile,
								options: {
									profile: id,
									keep_ip_settings: true,
									wait: 0,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			}
			presets[`save_profile_${id}`] = {
				type: 'button',
				category: 'Profiles',
				name: `Save to profile ${id}`,
				style: {
					text: `Save to profile ${id}`,
					size: 'auto',
					color: Color.Yellow,
					bgcolor: 0,
				},
				steps: [
					{
						down: [
							{
								actionId: ActionId.SaveProfile,
								options: {
									profile: id,
									name: `Profile ${id}`,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			}
		})

	if (device.groups) {
		const default_port = 1
		device.groups.forEach((g) => {
			presets[`set_port_to_group_${g.group_id}`] = {
				type: 'button',
				category: 'Group',
				name: `Set port to group ${g.group_id} - ${g.name}`,
				style: {
					text: `Port ${default_port}\\nset to\\n$(GigaCore:group_${g.group_id}_name)`,
					size: 12,
					color: Color.White,
					bgcolor: Color.hexToColor(g.color),
				},
				steps: [
					{
						down: [
							{
								actionId: ActionId.SetPortToGroup,
								options: {
									port: default_port,
									group: g.group_id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: FeedbackId.portProtected,
						options: {
							port_nr: default_port,
						},
						style: {
							color: Color.Red,
						},
					},
					{
						feedbackId: FeedbackId.groupColor,
						options: {
							id: g.group_id,
						},
						style: {
							bgcolor: Color.Black,
						},
					},
				],
			}
		})
	}

	if (device.nr_ports) {
		device.ports.forEach((_, i) => {
			const port_nr = i + 1
			presets[`port_state_${port_nr}`] = {
				type: 'button',
				category: 'Link State',
				name: `Link State for port ${port_nr}`,
				style: {
					text: `Link\\n$(GigaCore:port_${port_nr}_legend)`,
					size: 14,
					color: Color.White,
					bgcolor: Color.Black,
				},
				steps: [
					{
						down: [
							{
								actionId: ActionId.ToggleLink,
								options: {
									port_nr: port_nr,
									enabled: 'toggle',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: FeedbackId.portColor,
						options: {
							port_nr: port_nr,
						},
						style: {
							bgcolor: Color.Black,
						},
					},
					{
						feedbackId: FeedbackId.portState,
						options: {
							port_nr: port_nr,
						},
						style: {
							color: Color.Green,
						},
					},
					{
						feedbackId: FeedbackId.portDisabled,
						options: {
							port_nr: port_nr,
						},
						style: {
							color: Color.Grey,
						},
					},
					{
						feedbackId: FeedbackId.portProtected,
						options: {
							port_nr: port_nr,
						},
						style: {
							color: Color.Red,
						},
					},
				],
			}
			presets[`port_group_${port_nr}`] = {
				type: 'button',
				category: 'Group',
				name: `Increment group or trunk for port ${port_nr}`,
				style: {
					text: `$(GigaCore:port_${port_nr}_legend)\\n$(GigaCore:port_${port_nr}_member_name)`,
					size: 14,
					color: Color.White,
					bgcolor: Color.Black,
				},
				steps: [
					{
						down: [
							{
								actionId: ActionId.IncrementPortGroupOrTrunk,
								options: {
									port: port_nr,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: FeedbackId.portColor,
						options: {
							port_nr: port_nr,
						},
						style: {
							bgcolor: Color.Black,
						},
					},
					{
						feedbackId: FeedbackId.portState,
						options: {
							port_nr: port_nr,
						},
						style: {
							color: Color.Green,
						},
					},
					{
						feedbackId: FeedbackId.portProtected,
						options: {
							port_nr: port_nr,
						},
						style: {
							color: Color.Red,
						},
					},
				],
			}
		})
	}

	if (device.poe_ports && device.poe_capable) {
		device.poe_ports.forEach((port) => {
			const port_nr = port.port_number
			presets[`toggle_poe_port_${port_nr}`] = {
				type: 'button',
				category: 'PoE',
				name: `Toggle PoE on port ${port_nr}`,
				style: {
					text: `Toggle PoE $(GigaCore:port_${port_nr}_legend)`,
					size: 'auto',
					color: Color.White,
					bgcolor: 0,
				},
				steps: [
					{
						down: [
							{
								actionId: ActionId.TogglePoe,
								options: {
									port_nr: port_nr,
									enabled: 'toggle',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: FeedbackId.poeEnabled,
						options: {
							port_nr: port_nr,
						},
						style: {
							color: Color.Green,
						},
					},
					{
						feedbackId: FeedbackId.poeSourcing,
						options: {
							port_nr: port_nr,
						},
						style: {
							bgcolor: Color.Yellow,
						},
					},
				],
			}
		})
	}

	return presets
}
