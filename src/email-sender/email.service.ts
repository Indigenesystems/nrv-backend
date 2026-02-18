// email.service.ts

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';


@Injectable()
export class EmailService {
  
  private transporter: nodemailer.Transporter;

  constructor() {
    const host = process.env.SMTP_HOST || 'smtp.zoho.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secureFromEnv = process.env.SMTP_SECURE;
    const secure =
      secureFromEnv === undefined || secureFromEnv === ''
        ? port === 465
        : secureFromEnv === 'true';

    // Helpful warning for a very common misconfiguration:
    // - Port 465 expects implicit TLS (secure=true)
    // - Port 587 expects STARTTLS (secure=false)
    if (port === 465 && !secure) {
      console.warn(
        '[EmailService] SMTP_PORT is 465 but SMTP_SECURE is false. Set SMTP_SECURE=true for port 465.',
      );
    }
    if (port === 587 && secure) {
      console.warn(
        '[EmailService] SMTP_PORT is 587 but SMTP_SECURE is true. Set SMTP_SECURE=false for port 587.',
      );
    }
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure, // true for 465, false for 587 (STARTTLS)
      requireTLS: !secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      tls: {
        // Ensures SNI is set (helps with some providers/proxies)
        servername: host,
      },
    });
  }

  async sendUserCreatedEmail(payload: any): Promise<void> {
    const emailTemplate = `<!DOCTYPE html>
    <html>
    <head>
    
      <meta charset="utf-8">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <title>Account Creation</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style type="text/css">
      /**
       * Google webfonts. Recommended to include the .woff version for cross-client compatibility.
       */
      @media screen {
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 400;
          src: local('Source Sans Pro Regular'), local('SourceSansPro-Regular'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/ODelI1aHBYDBqgeIAH2zlBM0YzuT7MdOe03otPbuUS0.woff) format('woff');
        }
    
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 700;
          src: local('Source Sans Pro Bold'), local('SourceSansPro-Bold'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/toadOcfmlt9b38dHJxOBGFkQc6VGVFSmCnC_l7QZG60.woff) format('woff');
        }
      }
    
      body,
      table,
      td,
      a {
        -ms-text-size-adjust: 100%; /* 1 */
        -webkit-text-size-adjust: 100%; /* 2 */
      }
    
      table,
      td {
        mso-table-rspace: 0pt;
        mso-table-lspace: 0pt;
      }
    
      img {
        -ms-interpolation-mode: bicubic;
      }
    
      a[x-apple-data-detectors] {
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        color: inherit !important;
        text-decoration: none !important;
      }
    
      div[style*="margin: 16px 0;"] {
        margin: 0 !important;
      }
    
      body {
        width: 100% !important;
        height: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
    
      table {
        border-collapse: collapse !important;
      }
    
      a {
        color: #1a82e2;
      }
    
      img {
        height: auto;
        line-height: 100%;
        text-decoration: none;
        border: 0;
        outline: none;
      }
      </style>
    
    </head>
    <body style="background-color: #e9ecef;">
      <!-- start body -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
    
        <!-- start logo -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
              <tr>
                <td align="center" valign="top" style="padding: 36px 24px;">
                 <a href="https://nrv-frontend.onrender.com/" target="_blank" style="display: inline-block;">
                    <img src="https://res.cloudinary.com/dzv98o7ds/image/upload/v1734122260/nrv-logo_wzjwam.webp" alt="Logo" border="0" width="48" style="display: block; width: 48px; max-width: 48px; min-width: 48px;">
                  </a>
                </td>
              </tr>
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end logo -->
    
        <!-- start hero -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 36px 24px 0; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; border-top: 3px solid #d4dadf;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;">Welcome to Naija Rent Verify</h1>
                </td>
              </tr>
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end hero -->
    
        <!-- start copy block -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
    
              <!-- start copy -->
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0;">Dear [userName]</p>
                </td>
              </tr>
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0;">Thank you for signing up on Naija Rent Verify as a [accountType], we are pleased to have you here, kindly us the verification code below to complete your process.</p>
                </td>
              </tr>
              <tr>
              <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;">[verificationToken]</h1>
              </td>
            </tr>
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                    <p style="margin: 0;">If You have any questions or encounter any issues while accessing your account, please feel free to contact our support team at <a href="mailto:hello@naijarentverify.com">hello@naijarentverify.com</a>. We are here to assist you.</p>
                </td>
              </tr>

              <!-- end copy -->
    
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end copy block -->
    
        <!-- start footer -->
        <tr>
          <td align="center" bgcolor="#e9ecef" style="padding: 24px;">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
    
              <!-- start permission -->
        
              <!-- end permission -->
    
              <!-- start unsubscribe -->
              <tr>
                <td align="center" bgcolor="#e9ecef" style="padding: 12px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #666;">
                  <p style="margin: 0;"> &copy; <a href="#" target="_blank">Naija Rent Verify</a></p>
                </td>
              </tr>
              <!-- end unsubscribe -->
    
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end footer -->
    
      </table>
      <!-- end body -->
    
    </body>
    </html>`;

    const replacements = {
      '[userName]': payload.firstName + ' ' + payload.lastName,
      '[userEmail]': payload.email,
      '[verificationToken]': payload.confirmationCode,
      '[accountType]': payload.accountType,
    };

    const resultEmailTemplate = emailTemplate.replace(
      /\[userName\]|\[userRoleTag\]|\[userEmail\]|\[userPassword\]|\[verificationToken\]|\[accountType\]|\[loginUrl\]|\[supportTeamEmail\]/g,
      (match) => replacements[match],
    );

    try {
      const info = await this.transporter.sendMail({
        from: 'hello@naijarentverify.com',
        to: payload.email,
        subject: 'Welcome onboard',
        html: resultEmailTemplate,
      });
    } catch (error) {
      console.error('Email sending error: ', error);
      throw error;
    }
  }

  async sendApplicationInvitation(payload: any): Promise<void> {
    const emailTemplate = `<!DOCTYPE html>
    <html>
    <head>
    
      <meta charset="utf-8">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <title>Property Application Invitation</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style type="text/css">
      /**
       * Google webfonts. Recommended to include the .woff version for cross-client compatibility.
       */
      @media screen {
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 400;
          src: local('Source Sans Pro Regular'), local('SourceSansPro-Regular'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/ODelI1aHBYDBqgeIAH2zlBM0YzuT7MdOe03otPbuUS0.woff) format('woff');
        }
    
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 700;
          src: local('Source Sans Pro Bold'), local('SourceSansPro-Bold'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/toadOcfmlt9b38dHJxOBGFkQc6VGVFSmCnC_l7QZG60.woff) format('woff');
        }
      }
    
      body,
      table,
      td,
      a {
        -ms-text-size-adjust: 100%; /* 1 */
        -webkit-text-size-adjust: 100%; /* 2 */
      }
    
      table,
      td {
        mso-table-rspace: 0pt;
        mso-table-lspace: 0pt;
      }
    
      img {
        -ms-interpolation-mode: bicubic;
      }
    
      a[x-apple-data-detectors] {
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        color: inherit !important;
        text-decoration: none !important;
      }
    
      div[style*="margin: 16px 0;"] {
        margin: 0 !important;
      }
    
      body {
        width: 100% !important;
        height: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
    
      table {
        border-collapse: collapse !important;
      }
    
      a {
        color: #1a82e2;
      }
    
      img {
        height: auto;
        line-height: 100%;
        text-decoration: none;
        border: 0;
        outline: none;
      }
      </style>
    
    </head>
    <body style="background-color: #e9ecef;">
      <!-- start body -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
    
        <!-- start logo -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
              <tr>
                <td align="center" valign="top" style="padding: 36px 24px;">
            <a href="https://nrv-frontend.onrender.com/" target="_blank" style="display: inline-block;">
                    <img src="https://res.cloudinary.com/dzv98o7ds/image/upload/v1734122260/nrv-logo_wzjwam.webp" alt="Logo" border="0" width="48" style="display: block; width: 48px; max-width: 48px; min-width: 48px;">
                  </a>
                </td>
              </tr>
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end logo -->
    
        <!-- start hero -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 36px 24px 0; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; border-top: 3px solid #d4dadf;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;">Invitation to Property Application</h1>
                </td>
              </tr>
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end hero -->
    
        <!-- start copy block -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
    
              <!-- start copy -->
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0;">Dear [userName]</p>
                </td>
              </tr>
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0;">You being invited to apply for this property, use the link below to sign up on Naija Rent Verify and apply to the property</p>
                </td>
              </tr>
              <tr>
              <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
              <a href="https://nrv-frontend.vercel.app/dashboard/landlord/properties">Property Invitation</a>
            </td>

            </tr>
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                    <p style="margin: 0;">If You have any questions or encounter any issues while accessing your account, please feel free to contact our support team at <a href="mailto:hello@naijarentverify.com">support@naijarentverify.com</a>. We are here to assist you.</p>
                </td>
              </tr>

              <!-- end copy -->
    
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end copy block -->
    
        <!-- start footer -->
        <tr>
          <td align="center" bgcolor="#e9ecef" style="padding: 24px;">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
    
              <!-- start permission -->
        
              <!-- end permission -->
    
              <!-- start unsubscribe -->
              <tr>
                <td align="center" bgcolor="#e9ecef" style="padding: 12px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #666;">
                  <p style="margin: 0;"> &copy; <a href="#" target="_blank">Naija Rent Verify</a></p>
                </td>
              </tr>
              <!-- end unsubscribe -->
    
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end footer -->
    
      </table>
      <!-- end body -->
    
    </body>
    </html>`;

    const replacements = {
      '[userName]': payload.name,
      '[userEmail]': payload.email,
    };

    const resultEmailTemplate = emailTemplate.replace(
      /\[userName\]|\[userRoleTag\]|\[userEmail\]|\[userPassword\]|\[verificationToken\]|\[accountType\]|\[loginUrl\]|\[supportTeamEmail\]/g,
      (match) => replacements[match],
    );

    try {
      const info = await this.transporter.sendMail({
        from: 'hello@naijarentverify.com',
        to: payload.email,
        subject: 'Invitation to Apply',
        html: resultEmailTemplate,
      });
    } catch (error) {
      console.error('Email sending error: ', error);
      throw error;
    }
  }

  async sendUserCreatedByLandlordEmail(payload: any): Promise<void> {
    const emailTemplate = `<!DOCTYPE html>
    <html>
    <head>
    
      <meta charset="utf-8">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <title>Account Creation</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style type="text/css">
      /**
       * Google webfonts. Recommended to include the .woff version for cross-client compatibility.
       */
      @media screen {
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 400;
          src: local('Source Sans Pro Regular'), local('SourceSansPro-Regular'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/ODelI1aHBYDBqgeIAH2zlBM0YzuT7MdOe03otPbuUS0.woff) format('woff');
        }
    
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 700;
          src: local('Source Sans Pro Bold'), local('SourceSansPro-Bold'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/toadOcfmlt9b38dHJxOBGFkQc6VGVFSmCnC_l7QZG60.woff) format('woff');
        }
      }
    
      body,
      table,
      td,
      a {
        -ms-text-size-adjust: 100%; /* 1 */
        -webkit-text-size-adjust: 100%; /* 2 */
      }
    
      table,
      td {
        mso-table-rspace: 0pt;
        mso-table-lspace: 0pt;
      }
    
      img {
        -ms-interpolation-mode: bicubic;
      }
    
      a[x-apple-data-detectors] {
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        color: inherit !important;
        text-decoration: none !important;
      }
    
      div[style*="margin: 16px 0;"] {
        margin: 0 !important;
      }
    
      body {
        width: 100% !important;
        height: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
    
      table {
        border-collapse: collapse !important;
      }
    
      a {
        color: #1a82e2;
      }
    
      img {
        height: auto;
        line-height: 100%;
        text-decoration: none;
        border: 0;
        outline: none;
      }
      </style>
    
    </head>
    <body style="background-color: #e9ecef;">
      <!-- start body -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
    
        <!-- start logo -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
              <tr>
                <td align="center" valign="top" style="padding: 36px 24px;">
                <a href="https://nrv-frontend.onrender.com/" target="_blank" style="display: inline-block;">
                    <img src="https://res.cloudinary.com/dzv98o7ds/image/upload/v1734122260/nrv-logo_wzjwam.webp" alt="Logo" border="0" width="48" style="display: block; width: 48px; max-width: 48px; min-width: 48px;">
                  </a>
                </td>
              </tr>
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end logo -->
    
        <!-- start hero -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 36px 24px 0; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; border-top: 3px solid #d4dadf;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;">Welcome to Naija Rent Verify</h1>
                </td>
              </tr>
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end hero -->
    
        <!-- start copy block -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
    
              <!-- start copy -->
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0;">Dear [userName]</p>
                </td>
              </tr>
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0;">Your landlord has onboarded you as a tenant on Naija Rent Verify.</p>
                </td>
              </tr>
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 0 24px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0 0 8px;"><strong>Your temporary password:</strong></p>
                  <p style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 2px;">[verificationToken]</p>
                  <p style="margin: 12px 0 0; font-size: 14px; color: #666;">Use your email <strong>[userEmail]</strong> and this password to sign in. We recommend changing your password after your first login.</p>
                </td>
              </tr>
                            <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0;">Kindly click the link to sign in: <a href="[loginUrl]" style="color: #03442C; font-weight: 600;">[loginUrl]</a></p>
                </td>
              </tr>
              <tr>
  
            </tr>
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                    <p style="margin: 0;">If You have any questions or encounter any issues while accessing your account, please feel free to contact our support team at <a href="mailto:hello@naijarentverify.com">hello@naijarentverify.com</a>. We are here to assist you.</p>
                </td>
              </tr>

              <!-- end copy -->
    
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end copy block -->
    
        <!-- start footer -->
        <tr>
          <td align="center" bgcolor="#e9ecef" style="padding: 24px;">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
    
              <!-- start permission -->
        
              <!-- end permission -->
    
              <!-- start unsubscribe -->
              <tr>
                <td align="center" bgcolor="#e9ecef" style="padding: 12px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #666;">
                  <p style="margin: 0;"> &copy; <a href="#" target="_blank">Naija Rent Verify</a></p>
                </td>
              </tr>
              <!-- end unsubscribe -->
    
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end footer -->
    
      </table>
      <!-- end body -->
    
    </body>
    </html>`;

    const loginUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/sign-in` : 'https://www.naijarentverify.com/sign-in';
    const replacements = {
      '[userName]': payload.firstName + ' ' + payload.lastName,
      '[userEmail]': payload.email,
      '[verificationToken]': payload.password,
      '[accountType]': payload.accountType,
      '[loginUrl]': loginUrl,
    };

    const resultEmailTemplate = emailTemplate.replace(
      /\[userName\]|\[userRoleTag\]|\[userEmail\]|\[userPassword\]|\[verificationToken\]|\[accountType\]|\[loginUrl\]|\[supportTeamEmail\]/g,
      (match) => replacements[match] ?? match,
    );

    try {
      await this.transporter.sendMail({
        from: 'hello@naijarentverify.com',
        to: payload.email,
        subject: 'Your landlord has onboarded you on Naija Rent Verify',
        html: resultEmailTemplate,
      });
      console.log('Onboard/password email sent to', payload.email);
    } catch (error: any) {
      console.error('Onboard email send failed:', error?.message || error);
      throw error;
    }
  }

  async sendResetPasswordToken(payload: any): Promise<void> {
    const emailTemplate = `<!DOCTYPE html>
    <html>
    <head>
    
      <meta charset="utf-8">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <title>Account Creation</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style type="text/css">
      /**
       * Google webfonts. Recommended to include the .woff version for cross-client compatibility.
       */
      @media screen {
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 400;
          src: local('Source Sans Pro Regular'), local('SourceSansPro-Regular'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/ODelI1aHBYDBqgeIAH2zlBM0YzuT7MdOe03otPbuUS0.woff) format('woff');
        }
    
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 700;
          src: local('Source Sans Pro Bold'), local('SourceSansPro-Bold'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/toadOcfmlt9b38dHJxOBGFkQc6VGVFSmCnC_l7QZG60.woff) format('woff');
        }
      }
    
      body,
      table,
      td,
      a {
        -ms-text-size-adjust: 100%; /* 1 */
        -webkit-text-size-adjust: 100%; /* 2 */
      }
    
      table,
      td {
        mso-table-rspace: 0pt;
        mso-table-lspace: 0pt;
      }
    
      img {
        -ms-interpolation-mode: bicubic;
      }
    
      a[x-apple-data-detectors] {
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        color: inherit !important;
        text-decoration: none !important;
      }
    
      div[style*="margin: 16px 0;"] {
        margin: 0 !important;
      }
    
      body {
        width: 100% !important;
        height: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
    
      table {
        border-collapse: collapse !important;
      }
    
      a {
        color: #1a82e2;
      }
    
      img {
        height: auto;
        line-height: 100%;
        text-decoration: none;
        border: 0;
        outline: none;
      }
      </style>
    
    </head>
    <body style="background-color: #e9ecef;">
      <!-- start body -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
    
        <!-- start logo -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
              <tr>
                <td align="center" valign="top" style="padding: 36px 24px;">
                  <a href="https://nrv-frontend.onrender.com/" target="_blank" style="display: inline-block;">
                    <img src="https://res.cloudinary.com/dzv98o7ds/image/upload/v1734122260/nrv-logo_wzjwam.webp" alt="Logo" border="0" width="48" style="display: block; width: 48px; max-width: 48px; min-width: 48px;">
                  </a>
                </td>
              </tr>
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end logo -->
    
        <!-- start hero -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 36px 24px 0; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; border-top: 3px solid #d4dadf;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;">Welcome to Naija Rent Verify</h1>
                </td>
              </tr>
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end hero -->
    
        <!-- start copy block -->
        <tr>
          <td align="center" bgcolor="#e9ecef">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
    
              <!-- start copy -->
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0;">Dear [userName]</p>
                </td>
              </tr>
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <p style="margin: 0;">You made a request to reset your password. Kindly find the verification link - [verificationToken]</p>
                </td>
              </tr>
              <tr>
              <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;">[verificationToken]</h1>
              </td>
            </tr>
              <tr>
                <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                    <p style="margin: 0;">If You have any questions or encounter any issues while accessing your account, please feel free to contact our support team at <a href="mailto:hello@naijarentverify.com">hello@naijarentverify.com</a>. We are here to assist you.</p>
                </td>
              </tr>

              <!-- end copy -->
    
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end copy block -->
    
        <!-- start footer -->
        <tr>
          <td align="center" bgcolor="#e9ecef" style="padding: 24px;">
            <!--[if (gte mso 9)|(IE)]>
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600">
            <tr>
            <td align="center" valign="top" width="600">
            <![endif]-->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
    
              <!-- start permission -->
        
              <!-- end permission -->
    
              <!-- start unsubscribe -->
              <tr>
                <td align="center" bgcolor="#e9ecef" style="padding: 12px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #666;">
                  <p style="margin: 0;"> &copy; <a href="#" target="_blank">Naija Rent Verify</a></p>
                </td>
              </tr>
              <!-- end unsubscribe -->
    
            </table>
            <!--[if (gte mso 9)|(IE)]>
            </td>
            </tr>
            </table>
            <![endif]-->
          </td>
        </tr>
        <!-- end footer -->
    
      </table>
      <!-- end body -->
    
    </body>
    </html>`;

    const replacements = {
      '[userName]': payload._doc.firstName + ' ' + payload._doc.lastName,
      '[userEmail]': payload._doc.email,
      '[verificationToken]': payload.passwordResetToken,
      '[accountType]': payload.accountType,
    };

    const resultEmailTemplate = emailTemplate.replace(
      /\[userName\]|\[userRoleTag\]|\[userEmail\]|\[userPassword\]|\[verificationToken\]|\[accountType\]|\[loginUrl\]|\[supportTeamEmail\]/g,
      (match) => replacements[match],
    );

    try {
      const info = await this.transporter.sendMail({
        from: 'hello@naijarentverify.com',
        to: payload._doc.email,
        subject: 'Reset Password Code',
        html: resultEmailTemplate,
      });
      console.log('email sent successfully');
    } catch (error) {
      console.error('Email sending error: ', error);
      throw error;
    }
  }

  async sendMessageNotification(payload) {
    const emailTemplate = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <title>New Message Notification</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      @media screen {
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 400;
          src: local('Source Sans Pro Regular'), local('SourceSansPro-Regular'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/ODelI1aHBYDBqgeIAH2zlBM0YzuT7MdOe03otPbuUS0.woff) format('woff');
        }
  
        @font-face {
          font-family: 'Source Sans Pro';
          font-style: normal;
          font-weight: 700;
          src: local('Source Sans Pro Bold'), local('SourceSansPro-Bold'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/toadOcfmlt9b38dHJxOBGFkQc6VGVFSmCnC_l7QZG60.woff) format('woff');
        }
      }
  
      body,
      table,
      td,
      a {
        -ms-text-size-adjust: 100%;
        -webkit-text-size-adjust: 100%;
      }
  
      table,
      td {
        mso-table-rspace: 0pt;
        mso-table-lspace: 0pt;
      }
  
      img {
        -ms-interpolation-mode: bicubic;
      }
  
      a[x-apple-data-detectors] {
        font-family: inherit !important;
        font-size: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        color: inherit !important;
        text-decoration: none !important;
      }
  
      body {
        width: 100% !important;
        height: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
  
      table {
        border-collapse: collapse !important;
      }
  
      a {
        color: #1a82e2;
      }
  
      img {
        height: auto;
        line-height: 100%;
        text-decoration: none;
        border: 0;
        outline: none;
      }
    </style>
  </head>
  <body style="background-color: #ffffff;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
  
  
      <tr>
        <td align="center" bgcolor="#e9ecef">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
            <tr>
              <td align="left" bgcolor="#ffffff" style="padding: 36px 24px 0; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; border-top: 3px solid #d4dadf;">
                <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;">You Have a New Message</h1>
              </td>
            </tr>
          </table>
        </td>
      </tr>
  
      <tr>
        <td align="center" bgcolor="#e9ecef">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
            <tr>
              <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                <p style="margin: 0;">Hi [recipientName],</p>
              </td>
            </tr>
            <tr>
              <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                <p style="margin: 0;">You have received a new message from [senderName]:</p>
                <blockquote style="margin: 16px 0; padding: 16px; background-color: #f4f4f4; border-left: 4px solid #d4dadf;">
                  <p style="margin: 0; font-style: italic;">"[messageContent]"</p>
                </blockquote>
              </td>
            </tr>
            <tr>
              <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;">
                <p style="margin: 0;">If you have any questions or need assistance, feel free to contact our support team at <a href="mailto:support@naijarentverify.com">support@naijarentverify.com</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
  
      <tr>
        <td align="center" bgcolor="#e9ecef" style="padding: 24px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;">
            <tr>
              <td align="center" bgcolor="#e9ecef" style="padding: 12px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #666;">
                <p style="margin: 0;">&copy; Naija Rent Verify</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;

    const replacements = {
      '[recipientName]': payload.recipientName,
      '[senderName]': payload.senderName,
      '[messageContent]': payload.messageContent,
    };

    const resultEmailTemplate = emailTemplate.replace(
      /\[recipientName\]|\[senderName\]|\[messageContent\]/g,
      (match) => replacements[match],
    );

    try {
      const info = await this.transporter.sendMail({
        from: 'hello@naijarentverify.com',
        to: payload.recipientEmail,
        subject: 'You Have a New Message',
        html: resultEmailTemplate,
      });
      console.log('Email sent successfully');
    } catch (error) {
      console.error('Email sending error: ', error);
      throw error;
    }
  }

  private getFrontendUrl(): string {
    return (
      process.env.FRONTEND_URL ||
      'https://www.naijarentverify.com'
    ).replace(/\/+$/, '');
  }

  private renderSimpleEmail(params: {
    title: string;
    preheader?: string;
    contentHtml: string;
  }): string {
    const { title, preheader, contentHtml } = params;
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#e9ecef;font-family:Segoe UI, Helvetica, Arial, sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${preheader || ''}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#e9ecef;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:18px 24px;border-bottom:3px solid #03442C;">
                <div style="font-weight:700;color:#03442C;font-size:16px;">Naija Rent Verify</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#101828;">${title}</h1>
                <div style="font-size:15px;line-height:1.6;color:#344054;">
                  ${contentHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;background:#f8fafc;color:#667085;font-size:12px;line-height:1.4;">
                &copy; ${new Date().getFullYear()} Naija Rent Verify
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  async sendNewPropertyApplicationNotificationToLandlord(payload: {
    landlordEmail: string;
    landlordName: string;
    applicantName: string;
    applicantEmail: string;
    propertyTitle: string;
    propertyLocation?: string;
    actionUrl?: string;
  }): Promise<void> {
    const actionUrl =
      payload.actionUrl || `${this.getFrontendUrl()}/dashboard/landlord/tenants`;

    const html = this.renderSimpleEmail({
      title: `New application for ${payload.propertyTitle}`,
      preheader: `${payload.applicantName} just applied.`,
      contentHtml: `
        <p style="margin:0 0 12px;">Hello ${payload.landlordName},</p>
        <p style="margin:0 0 12px;"><strong>${payload.applicantName}</strong> just submitted a rental application.</p>
        <p style="margin:0 0 6px;"><strong>Applicant email:</strong> ${payload.applicantEmail}</p>
        ${
          payload.propertyLocation
            ? `<p style="margin:0 0 12px;"><strong>Property:</strong> ${payload.propertyLocation}</p>`
            : ''
        }
        <p style="margin:16px 0 0;">
          <a href="${actionUrl}" target="_blank" style="display:inline-block;background:#03442C;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600;">
            Review application
          </a>
        </p>
        <p style="margin:12px 0 0;font-size:13px;color:#667085;">If the button doesn’t work, copy this link: <a href="${actionUrl}" target="_blank" style="color:#03442C;">${actionUrl}</a></p>
      `,
    });

    await this.transporter.sendMail({
      from: 'hello@naijarentverify.com',
      to: payload.landlordEmail,
      subject: `New application: ${payload.propertyTitle}`,
      html,
    });
  }

  async sendPropertyApplicationConfirmationToApplicant(payload: {
    applicantEmail: string;
    applicantName: string;
    propertyTitle: string;
    propertyLocation?: string;
    actionUrl?: string;
  }): Promise<void> {
    const actionUrl =
      payload.actionUrl || `${this.getFrontendUrl()}/dashboard/tenant`;

    const html = this.renderSimpleEmail({
      title: `Application received: ${payload.propertyTitle}`,
      preheader: `We’ve received your application.`,
      contentHtml: `
        <p style="margin:0 0 12px;">Hello ${payload.applicantName},</p>
        <p style="margin:0 0 12px;">We’ve received your rental application and sent it to the landlord for review.</p>
        ${
          payload.propertyLocation
            ? `<p style="margin:0 0 12px;"><strong>Property:</strong> ${payload.propertyLocation}</p>`
            : ''
        }
        <p style="margin:16px 0 0;">
          <a href="${actionUrl}" target="_blank" style="display:inline-block;background:#03442C;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600;">
            View your applications
          </a>
        </p>
        <p style="margin:12px 0 0;font-size:13px;color:#667085;">If the button doesn’t work, copy this link: <a href="${actionUrl}" target="_blank" style="color:#03442C;">${actionUrl}</a></p>
      `,
    });

    await this.transporter.sendMail({
      from: 'hello@naijarentverify.com',
      to: payload.applicantEmail,
      subject: `We received your application: ${payload.propertyTitle}`,
      html,
    });
  }

  async sendApplicationStatusUpdateToApplicant(payload: {
    applicantEmail: string;
    applicantName: string;
    status: string;
    propertyTitle: string;
    propertyLocation?: string;
    actionUrl?: string;
  }): Promise<void> {
    const actionUrl =
      payload.actionUrl || `${this.getFrontendUrl()}/dashboard/tenant`;

    const html = this.renderSimpleEmail({
      title: `Application update: ${payload.propertyTitle}`,
      preheader: `Your application status is now ${payload.status}.`,
      contentHtml: `
        <p style="margin:0 0 12px;">Hello ${payload.applicantName},</p>
        <p style="margin:0 0 12px;">Your application status has been updated to <strong>${payload.status}</strong>.</p>
        ${
          payload.propertyLocation
            ? `<p style="margin:0 0 12px;"><strong>Property:</strong> ${payload.propertyLocation}</p>`
            : ''
        }
        <p style="margin:16px 0 0;">
          <a href="${actionUrl}" target="_blank" style="display:inline-block;background:#03442C;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600;">
            View application
          </a>
        </p>
        <p style="margin:12px 0 0;font-size:13px;color:#667085;">If the button doesn’t work, copy this link: <a href="${actionUrl}" target="_blank" style="color:#03442C;">${actionUrl}</a></p>
      `,
    });

    await this.transporter.sendMail({
      from: 'hello@naijarentverify.com',
      to: payload.applicantEmail,
      subject: `Application status: ${payload.status} (${payload.propertyTitle})`,
      html,
    });
  }

async sendTenantVerificationInviteEmail(payload: {
  recipientName: string;
  recipientEmail: string;
  landlordName: string;
  formLink: string;
}) {
  const emailTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <title>Verification Request - Naija Rent Verify</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style type="text/css">
    body, table, td, a { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    table, td { mso-table-rspace: 0pt; mso-table-lspace: 0pt; }
    a[x-apple-data-detectors] { font-family: inherit !important; font-size: inherit !important; color: inherit !important; text-decoration: none !important; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    .button-link { display: inline-block; background-color: #03442C; color: #ffffff !important; padding: 14px 32px; text-decoration: none; font-weight: 600; border-radius: 6px; font-size: 16px; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #e9ecef; font-family: 'Segoe UI', Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
    <tr>
      <td align="center" style="padding: 32px 16px;" bgcolor="#e9ecef">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;" role="presentation">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 0 0 24px 0;">
              <a href="https://www.naijarentverify.com" target="_blank" style="display: inline-block;">
                <img src="https://res.cloudinary.com/dzv98o7ds/image/upload/v1734122260/nrv-logo_wzjwam.webp" alt="Naija Rent Verify" width="48" height="48" style="display: block; width: 48px; height: 48px; border: 0;" />
              </a>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td bgcolor="#ffffff" style="border-radius: 8px; border: 1px solid #e0e0e0; overflow: hidden;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
                <tr>
                  <td style="padding: 32px 24px 24px; border-bottom: 3px solid #03442C;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">Verification request from your landlord</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #333333;">Hello ${payload.recipientName},</p>
                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #333333;"><strong>${payload.landlordName}</strong> has requested to verify your rental details through Naija Rent Verify. Please complete the verification form so your landlord can review your application.</p>
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td align="center" style="padding: 8px 0 24px;">
                          <a href="${payload.formLink}" class="button-link" target="_blank">Complete verification form</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #666666;">Or copy and paste this link into your browser:</p>
                    <p style="margin: 8px 0 0; font-size: 14px; line-height: 1.5;"><a href="${payload.formLink}" style="color: #03442C; word-break: break-all;">${payload.formLink}</a></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 24px 24px;">
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #888888;">If you didn’t expect this request, you can ignore this email.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 16px; font-size: 13px; color: #888888;">
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} Naija Rent Verify. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await this.transporter.sendMail({
      from: 'hello@naijarentverify.com',
      to: payload.recipientEmail,
      subject: `Action Required: Verification Request from ${payload.landlordName}`,
      html: emailTemplate,
    });

    console.log('Tenant verification invite email sent');
  } catch (err) {
    console.error('Error sending tenant invite:', err);
    throw new InternalServerErrorException('Could not send tenant invite email.');
  }
}


}
