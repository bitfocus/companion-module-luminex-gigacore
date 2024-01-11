import { InstanceBase, type SomeCompanionConfigField } from '@companion-module/base'

export interface config {
	bonjour_host: string
	host: string
	password: string
	gen1: boolean
}

export interface InstanceBaseExt<TConfig> extends InstanceBase<TConfig> {
	[x: string]: any
	config: TConfig
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
			isVisible: (options) => !options['bonjour_host'],
			width: 4,
		},
		{
			type: 'static-text',
			id: 'gigacore-filler',
			width: 4,
			label: '',
			isVisible: (options) => !!options['bonjour_host'],
			value: '',
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
