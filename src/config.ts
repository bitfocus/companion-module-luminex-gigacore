import { InstanceBase, type SomeCompanionConfigField, type InstanceTypes } from '@companion-module/base'

export interface config {
	bonjour_host: string
	host: string
	password: string
	gen1: boolean
	[key: string]: any
}

export interface ModuleInstanceTypes extends InstanceTypes {}

export const instanceTypes: ModuleInstanceTypes = {
	config: {} as config,
	secrets: {},
	actions: {},
	feedbacks: {},
	variables: {},
}

export interface InstanceBaseExt<TInstanceTypes extends InstanceTypes> extends InstanceBase<TInstanceTypes> {
	config: TInstanceTypes['config']
	UpdateVariablesValues(): void
	InitVariables(): void
}

export const getConfigFields = (): SomeCompanionConfigField[] => {
	return [
		{
			type: 'bonjour-device',
			id: 'bonjour_host',
			label: 'GigaCore',
			width: 6,
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'GigaCore IP',
			width: 4,
			isVisibleExpression: `!!!$(options:bonjour_host)`,
		},
		{
			type: 'checkbox',
			id: 'gen1',
			width: 2,
			label: 'Gen1',
			tooltip:
				'Check this box if you are trying to connect to one of the following models of GigaCore:\n- GigaCore10\n- GigaCore12\n- GigaCore14R\n- GigaCore16Xt\n- GigaCore16RFO\n- GigaCore26i',
			default: false,
		},
		{
			type: 'textinput',
			id: 'password',
			label: 'Password',
			tooltip: 'Only provide a password when authentication is enabled on the device',
			width: 6,
			default: '',
		},
	]
}
