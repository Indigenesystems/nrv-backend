import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Application,
  ApplicationStatus,
} from './entities/application.entity';
import { LandlordAssignedTenant } from './entities/landlord_assigned_tenant.entity';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../email-sender/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeaseLifecycleService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<Application>,
    @InjectModel(LandlordAssignedTenant.name)
    private readonly landlordAssignedTenantModel: Model<LandlordAssignedTenant>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    // Run soon after boot, then hourly.
    void this.expireDueLeases();
    this.timer = setInterval(
      () => {
        void this.expireDueLeases();
      },
      60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * Marks Active_lease records as Expired when rentEndDate is before today,
   * then notifies the landlord once (in-app + email).
   */
  async expireDueLeases(): Promise<number> {
    if (this.isRunning) {
      return 0;
    }
    this.isRunning = true;

    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const dueFilter = {
        status: ApplicationStatus.ACTIVE_LEASE,
        rentEndDate: { $ne: null, $lt: startOfToday },
      };

      const [applications, assigned] = await Promise.all([
        this.applicationModel
          .find(dueFilter)
          .populate('ownerId', 'firstName lastName email')
          .populate('applicant', 'firstName lastName email')
          .populate({ path: 'propertyId', populate: { path: 'propertyId' } })
          .exec(),
        this.landlordAssignedTenantModel
          .find(dueFilter)
          .populate('ownerId', 'firstName lastName email')
          .populate('applicant', 'firstName lastName email')
          .populate({ path: 'propertyId', populate: { path: 'propertyId' } })
          .exec(),
      ]);

      const dueLeases = [...applications, ...assigned];
      if (dueLeases.length === 0) {
        return 0;
      }

      let expiredCount = 0;
      for (const lease of dueLeases) {
        try {
          lease.status = ApplicationStatus.EXPIRED;
          await lease.save();
          expiredCount += 1;
          await this.notifyLandlordOfLeaseExpiry(lease);
        } catch (error) {
          console.error(
            `[LeaseLifecycle] Failed to expire lease ${String((lease as any)?._id)}:`,
            (error as Error)?.message || error,
          );
        }
      }

      return expiredCount;
    } finally {
      this.isRunning = false;
    }
  }

  private async notifyLandlordOfLeaseExpiry(lease: any): Promise<void> {
    let landlord: any = lease?.ownerId;
    if (landlord && typeof landlord === 'string') {
      landlord = await this.userModel
        .findById(landlord)
        .select('firstName lastName email')
        .lean();
    } else if (landlord?._id && !landlord?.email) {
      landlord = await this.userModel
        .findById(landlord._id)
        .select('firstName lastName email')
        .lean();
    }

    if (!landlord?._id) {
      return;
    }

    const applicant = lease?.applicant || {};
    const applicantName =
      [applicant?.firstName, applicant?.lastName].filter(Boolean).join(' ') ||
      'your tenant';
    const room = lease?.propertyId;
    const listing = room?.propertyId;
    const propertyTitle =
      room?.description ||
      room?.apartmentType ||
      listing?.streetAddress ||
      'a property unit';
    const leaseId = String(lease?._id || '');
    const actionUrl = `/dashboard/landlord/tenants/${leaseId}`;
    const endDateLabel = lease?.rentEndDate
      ? new Date(lease.rentEndDate).toLocaleDateString('en-NG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'the lease end date';

    await this.notificationsService.create({
      targetRole: 'landlord',
      userId: String(landlord._id),
      type: 'lease_expired',
      title: `Lease ended: ${propertyTitle}`,
      body: `The lease with ${applicantName} reached its end date (${endDateLabel}). Renew the lease or add a comment and close it.`,
      metadata: {
        applicationId: leaseId,
        applicantName,
        propertyTitle,
        actionUrl,
      },
    });

    if (landlord.email) {
      await this.emailService.sendLeaseExpiredNotificationToLandlord({
        landlordEmail: landlord.email,
        landlordName: landlord.firstName || 'Landlord',
        applicantName,
        propertyTitle,
        endDateLabel,
        actionUrl,
      });
    }
  }
}
