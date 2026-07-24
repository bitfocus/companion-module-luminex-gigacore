import type {
	CompanionStaticUpgradeScript,
	CompanionStaticUpgradeProps,
	CompanionStaticUpgradeResult,
	CompanionUpgradeContext,
} from '@companion-module/base'
import type { config, secrets } from './config.js'

export const upgradeScripts: CompanionStaticUpgradeScript<config, secrets>[] = [
	/*
	 * Upgrade script to move the password from the config store to the secrets store.
	 * The password field was changed to a `secret-text` field, whose value lives in the
	 * secrets store instead of the config store. Migrate any existing password so that
	 * authentication keeps working after the upgrade, and remove the plain-text copy
	 * from the config store.
	 */
	(
		_context: CompanionUpgradeContext<config>,
		props: CompanionStaticUpgradeProps<config, secrets>,
	): CompanionStaticUpgradeResult<config, secrets> => {
		const legacyPassword = props.config?.password

		if (props.config == null || legacyPassword === undefined) {
			return {
				updatedConfig: null,
				updatedSecrets: null,
				updatedActions: [],
				updatedFeedbacks: [],
			}
		}

		const updatedConfig = { ...props.config }
		delete updatedConfig.password

		return {
			updatedConfig,
			updatedSecrets: {
				...props.secrets,
				password: legacyPassword,
			},
			updatedActions: [],
			updatedFeedbacks: [],
		}
	},
]
