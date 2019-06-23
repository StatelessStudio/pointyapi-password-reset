# PointyAPI User Password-Reset Module

[Created by Stateless Studio](https://stateless.studio)

## Step 1: Installation

`npm i pointyapi-password-reset`

You'll also need the `Mailer` PointyAPI Module.

## Step 2: Create email templates

Create a password reset template (in `/assets/html/emails` or wherever you store templates):

`/assets/html/emails/pw-reset.html`
```html
<table align="center" border="0" cellpadding="0" cellspacing="0" class="email-container" style="width:600px">
	<tbody>
		<tr>
			<td style="text-align:center">
				<h2>{{fname}},</h2>
				<p>Someone has requested a password reset for your account.</p>
				<p>If this was you, please confirm this change:</p>
				<br>
				<a class="button-a" href="{{reset_link}}" style="background: #2674fb; border: 15px solid #2674fb; padding: 0 10px;color: #ffffff; font-family: sans-serif; font-size: 13px; line-height: 1.1; text-align: center; text-decoration: none; display: block; border-radius: 3px; font-weight: bold; max-width: 200px; margin: auto;">Confirm Password</a>
			</td>
		</tr>
	</tbody>
</table>
```

Add these template files to our sample data module:

`/src/test-data.ts`
```typescript
	...
	await addResource(EmailTemplate, {
		keyname: 'pw-reset',
		subject: 'You have requested a password reset',
		body: fs.readFileSync('assets/html/emails/pw-reset.html', {
			encoding: 'utf8'
		})
	});
	...
```

## Step 3: Initialize PasswordResetModule

Import the module into your server, and run `init` in the `pointy.before` function.

`/src/server.ts`
```typescript
...
import { mailer } from './Mailer';
import { User } from './models/user';

// Import PasswordResetModule
import { PasswordResetModule } from 'pointyapi-user-activation';

...

pointy.before = (app) => {
	...
	PasswordResetModule.init(mailer, User);
	...
}

...

```

## Step 4: Add tempPassword to your User entity

```typescript
@Entity()
class User extends BaseUser {
	...

	// Password (temporary)
	@Column({ nullable: true })
	@Length(1, 250)
	@IsOptional()
	@OnlySelfCanWrite()
	public tempPassword: string = undefined;

	...
}

```

## Step 5: Add routes

`/src/routes/user.ts`
```typescript
// Password Reset routes
router.post('/send-password-reset/', PasswordResetModule.sendEndpoint);
router.post('/confirm-password-reset/', PasswordResetModule.activationEndpoint);
```
