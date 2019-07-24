import { getRepository } from 'typeorm';
import { runHook } from 'pointyapi/utils';

// Token
import { jwtBearer, pointy } from 'pointyapi';

// Password
import { hashSync } from 'bcryptjs';

/**
 * User Activation Module
 */
export class PointyPasswordReset {
	// Linkback url
	public clientUrl: string = process.env.CLIENT_URL;
	public clientEndpoint = '/confirm-password-reset';

	// PointyAPI Mailer module
	public mailer;
	public resetTemplate = 'pw-reset';

	// PointyAPI User Type
	public userType;

	// PointyAPI JwtBearer module
	public jwtBearer = jwtBearer;

	/**
	 * Constructor
	 */
	constructor() {
		this.sendEndpoint = this.sendEndpoint.bind(this);
		this.activationEndpoint = this.activationEndpoint.bind(this);
	}

	/**
	 * Initialize
	 * @param mailer Instance of PointyAPI Mailer module
	 * @param userType User type
	 * @param jwtBearer (Optional) Custom jwtBearer instances
	 */
	public init(mailer, userType, jwt?) {
		this.mailer = mailer;
		this.userType = userType;

		if (jwt) {
			this.jwtBearer = jwt;
		}
	}

	/**
	 * Log
	 * @param data Data to log
	 */
	public log(...data) {
		console.log(data);
	}

	/**
	 * Create activation link
	 * @param user User to create link for
	 * @return String
	 */
	public createLink(user) {
		// Generate activation token
		const activateToken = this.jwtBearer.sign(user, false, {
			isPasswordReset: true
		});

		return `${this.clientUrl}${this.clientEndpoint}?id=${activateToken}`;
	}

	/**
	 * Send (or resend) activation link
	 * @param request Request object
	 * @param response Response object
	 * @return Async boolean
	 */
	public async send(request, response) {
		// Check request body
		if (!('email' in request.body) || !request.body.email) {
			response.validationResponder('email');
			return false;
		}

		if (!('password' in request.body) || !request.body.password) {
			response.validationResponder('password');
			return false;
		}

		// Find user by email
		const user: any = await getRepository(this.userType)
			.findOne({
				where: [
					{ email: request.body.email },
					{ tempEmail: request.body.email }
				]
			})
			.catch((error) => {
				response.error('Could not load user');
				pointy.error(error);

				return false;
			});

		if (!user) {
			response.goneResponder('Email address not found');
			return false;
		}

		// Set user's tempPassword
		user.tempPassword = hashSync(request.body.password, 12);

		// Save user
		const status = await getRepository(this.userType)
			.save(user)
			.then(() => true)
			.catch((error) => {
				pointy.error(error);
				response.error('Could not save user');
				return false;
			});

		// Send email

		// Get template
		const template = this.mailer.getTemplate(this.resetTemplate);

		if (status && template) {
			user.reset_link = await this.createLink(user);

			return await this.mailer
				.sendFromTemplate(
					request.body.email,
					{
						subject: template.subject,
						body: template.body
					},
					user
				)
				.then(() => true)
				.catch(() => {
					response.error('Could not send');
					return false;
				});
		}
		else {
			response.error('Could not send');
			return false;
		}
	}

	/**
	 * Resend activation endpoint
	 */
	public async sendEndpoint(request, response, next) {
		const result = await this.send(request, response);

		if (result) {
			response.sendStatus(204);
		}
	}

	/**
	 * Confirm activation endpoint
	 */
	public async activationEndpoint(request, response, next) {
		// Check if body exists & contains an confirmation token
		if (request.body && 'resetToken' in request.body) {
			const resetToken = request.body.resetToken;

			// Check if it is valid
			if (resetToken && typeof resetToken === 'string') {
				// Decode key
				const decoded = this.jwtBearer.dryVerify(resetToken);

				// Check token
				if (
					!decoded ||
					!('id' in decoded) ||
					!('isPasswordReset' in decoded) ||
					!decoded.isPasswordReset
				) {
					response.validationResponder('Invalid token');
					return false;
				}

				// Get user
				const user: any = await getRepository(this.userType)
					.findOne({ id: decoded.id })
					.catch((error) => response.error('Could not load user'));

				if (user) {
					// Check temp password
					if (!user.tempPassword) {
						response.sendStatus(204);
						return;
					}

					// Update user's password
					user.password = user.tempPassword;
					user.tempPassword = null;

					const hook: any = await runHook(
						'onPasswordReset',
						user,
						request,
						response
					);

					if (hook && hook instanceof Array && hook.length) {
						// Save user
						await getRepository(request.userType)
							.save(hook[0])
							.then(() => response.sendStatus(204))
							.catch((error) => {
								response.error('Could not update user');
							});
					}
				}
				else {
					// Unauthenticated
					response.unauthorizedResponder('Confirmation code expired');
				}
			}
			else {
				// Bad request
				response.validationResponder('Invalid confirmation code');
			}
		}
		else {
			// Bad request
			response.validationResponder('Please supply confirmation code');
		}

		next();
	}
}

export const PasswordResetModule = new PointyPasswordReset();
