import { Device } from './device.js'
import * as Color from './colors.js'
import { ActionId } from './actions.js'
import { FeedbackId } from './feedbacks.js'
import { type CompanionPresetDefinitions, type CompanionPresetSection } from '@companion-module/base'

export function getPresets(device: Device): {
	sections: CompanionPresetSection[]
	presets: CompanionPresetDefinitions<any>
} {
	const presets: CompanionPresetDefinitions<any> = {}
	const sections: CompanionPresetSection[] = []

	const devicePresets: string[] = []
	const profilePresets: string[] = []
	const groupPresets: string[] = []
	const linkStatePresets: string[] = []
	const poePresets: string[] = []

	presets[`device`] = {
		type: 'simple',
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
	devicePresets.push('device')

	presets[`reboot`] = {
		type: 'simple',
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
	devicePresets.push('reboot')

	presets[`reset`] = {
		type: 'simple',
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
	devicePresets.push('reset')

	presets[`active_profile`] = {
		type: 'simple',
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
	profilePresets.push('active_profile')

	Array(device.getNrProfiles())
		.fill(0)
		.forEach((_, i) => {
			const id = i + 1
			presets[`recall_profile_${id}`] = {
				type: 'simple',
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
			profilePresets.push(`recall_profile_${id}`)
			presets[`save_profile_${id}`] = {
				type: 'simple',
				name: `Save to profile ${id}`,
				style: {
					text: `Save to profile ${id}`,
					size: 'auto',
					color: Color.Yellow,
					bgcolor: Color.Grey,
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
				feedbacks: [
					{
						feedbackId: FeedbackId.profileProtected,
						options: {
							profile: id,
						},
						style: {
							color: Color.Red,
						},
					},
				],
			}
			profilePresets.push(`save_profile_${id}`)
		})

	if (device.groups) {
		const default_port = 1
		device.groups.forEach((g) => {
			presets[`set_port_to_group_${g.group_id}`] = {
				type: 'simple',
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
			groupPresets.push(`set_port_to_group_${g.group_id}`)
		})
	}

	if (device.nr_ports) {
		device.ports.forEach((_, i) => {
			const port_nr = i + 1
			presets[`port_state_${port_nr}`] = {
				type: 'simple',
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
			linkStatePresets.push(`port_state_${port_nr}`)
			presets[`port_group_${port_nr}`] = {
				type: 'simple',
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
			groupPresets.push(`port_group_${port_nr}`)
		})
	}

	if (device.poe_ports && device.poe_capable) {
		device.poe_ports.forEach((port) => {
			const port_nr = port.port_number
			presets[`toggle_poe_port_${port_nr}`] = {
				type: 'simple',
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
			poePresets.push(`toggle_poe_port_${port_nr}`)
		})
	}

	if (devicePresets.length > 0)
		sections.push({
			id: 'device',
			name: 'Device',
			definitions: [{ id: 'device-group', type: 'simple', name: 'Device Presets', presets: devicePresets }],
		})
	if (profilePresets.length > 0)
		sections.push({
			id: 'profiles',
			name: 'Profiles',
			definitions: [{ id: 'profile-group', type: 'simple', name: 'Profile Presets', presets: profilePresets }],
		})
	if (groupPresets.length > 0)
		sections.push({
			id: 'group',
			name: 'Group',
			definitions: [{ id: 'group-group', type: 'simple', name: 'Group Presets', presets: groupPresets }],
		})
	if (linkStatePresets.length > 0)
		sections.push({
			id: 'link-state',
			name: 'Link State',
			definitions: [{ id: 'link-state-group', type: 'simple', name: 'Link State Presets', presets: linkStatePresets }],
		})
	if (poePresets.length > 0)
		sections.push({
			id: 'poe',
			name: 'PoE',
			definitions: [{ id: 'poe-group', type: 'simple', name: 'PoE Presets', presets: poePresets }],
		})

	return { sections, presets }
}
