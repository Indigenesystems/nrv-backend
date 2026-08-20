import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { CloudinaryService } from '../upload/cloudinary.service';
import {
  Maintenance,
  MaintenanceStatus,
} from './entities/maintenance.entity';
import { AgreementDocuments } from 'src/properties/entities/agreement_documents.entity';
import { paginateAndSummarize } from 'src/helper/pagination.helper';
import { EmailService } from '../email-sender/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectModel(Maintenance.name)
    private readonly maintenanceModel: Model<Maintenance>,
    @InjectModel(AgreementDocuments.name)
    private readonly agreementDocumentsModel: Model<AgreementDocuments>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createMaintenanceDto: any): Promise<Maintenance> {
    try {
      const latestMaintenance = await this.maintenanceModel
        .findOne({}, { maintenanceId: 1 })
        .sort({ maintenanceId: -1 })
        .limit(1);
      const maxMaintenanceId = latestMaintenance
        ? latestMaintenance.maintenanceId
        : 0;
      const fileUrl = createMaintenanceDto.file?.[0]
        ? await this.cloudinaryService.upload(createMaintenanceDto.file[0])
        : undefined;
      const maintenanceId = maxMaintenanceId + 1;

      const newMaintenance = new this.maintenanceModel({
        maintenanceId,
        title: createMaintenanceDto.title,
        description: createMaintenanceDto.description,
        roomId: createMaintenanceDto.roomId,
        createdBy: createMaintenanceDto.createdBy,
        priority: createMaintenanceDto.priority || 'Medium',
        file: fileUrl,
        statusHistory: [
          {
            status: MaintenanceStatus.NEW,
            changedAt: new Date(),
            note: 'Maintenance request logged by tenant',
          },
        ],
      });

      const savedMaintenance = await newMaintenance.save();
      this.queueLifecycleNotification(
        String((savedMaintenance as any)._id),
        'created',
      );
      return savedMaintenance;
    } catch (error) {
      throw new Error(`Failed to log maintenance: ${error.message}`);
    }
  }

  async update(id: string, updateMaintenanceDto: any): Promise<Maintenance> {
    try {
      const currentMaintenance = await this.maintenanceModel.findById(id);
      if (!currentMaintenance) {
        throw new NotFoundException('Maintenance not found');
      }

      const updateData: any = {};
      const reservedFields = new Set([
        '_id',
        'createdBy',
        'maintenanceId',
        'roomId',
        'statusHistory',
        'file',
      ]);

      Object.keys(updateMaintenanceDto).forEach((key) => {
        if (
          !reservedFields.has(key) &&
          updateMaintenanceDto[key] !== undefined &&
          updateMaintenanceDto[key] !== null
        ) {
          updateData[key] = updateMaintenanceDto[key];
        }
      });

      if (updateMaintenanceDto.file && updateMaintenanceDto.file.length > 0) {
        const fileUrl = await this.cloudinaryService.upload(
          updateMaintenanceDto.file[0],
        );
        updateData.file = fileUrl;
      }

      if (
        updateData.status &&
        !Object.values(MaintenanceStatus).includes(updateData.status)
      ) {
        throw new BadRequestException('Invalid maintenance status');
      }

      const scheduleFields = [
        'assignedTo',
        'assigneePhoneNumber',
        'scheduledDate',
        'scheduledTime',
      ];
      const scheduleChanged = scheduleFields.some(
        (field) =>
          updateData[field] !== undefined &&
          String(updateData[field]) !==
            String((currentMaintenance as any)[field] ?? ''),
      );
      const schedule = {
        assignedTo:
          updateData.assignedTo ?? (currentMaintenance as any).assignedTo,
        assigneePhoneNumber:
          updateData.assigneePhoneNumber ??
          (currentMaintenance as any).assigneePhoneNumber,
        scheduledDate:
          updateData.scheduledDate ?? (currentMaintenance as any).scheduledDate,
        scheduledTime:
          updateData.scheduledTime ?? (currentMaintenance as any).scheduledTime,
      };
      const hasCompleteSchedule = Boolean(
        schedule.assignedTo &&
          schedule.assigneePhoneNumber &&
          schedule.scheduledDate &&
          schedule.scheduledTime,
      );

      if (
        scheduleChanged &&
        hasCompleteSchedule &&
        !updateData.status &&
        currentMaintenance.status === MaintenanceStatus.NEW
      ) {
        updateData.status = MaintenanceStatus.ACKNOWLEDGED;
      }

      const statusChanged =
        updateData.status && updateData.status !== currentMaintenance.status;
      const databaseUpdate: Record<string, unknown> = { $set: updateData };
      if (statusChanged) {
        databaseUpdate.$push = {
          statusHistory: {
            status: updateData.status,
            changedAt: new Date(),
            note: hasCompleteSchedule
              ? 'Vendor visit scheduled by landlord'
              : `Status updated to ${updateData.status}`,
          },
        };
      }

      const updatedMaintenance = await this.maintenanceModel.findByIdAndUpdate(
        id,
        databaseUpdate,
        { new: true },
      );

      if (!updatedMaintenance) {
        throw new Error('Maintenance not found');
      }

      if (scheduleChanged && hasCompleteSchedule) {
        this.queueLifecycleNotification(id, 'scheduled');
      } else if (statusChanged) {
        this.queueLifecycleNotification(id, 'status');
      }

      return updatedMaintenance;
    } catch (error) {
      throw new Error(`Failed to update maintenance: ${error.message}`);
    }
  }

  private queueLifecycleNotification(
    maintenanceId: string,
    event: 'created' | 'scheduled' | 'status',
  ): void {
    void this.sendLifecycleNotification(maintenanceId, event).catch((error) => {
      this.logger.error(
        `Maintenance ${event} notification failed for ${maintenanceId}`,
        error?.stack || error?.message,
      );
    });
  }

  private formatPersonName(user: any): string {
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'there';
  }

  private formatPropertyLabel(maintenance: any): string {
    const room = maintenance?.roomId;
    const property = room?.propertyId;
    const apartmentName =
      room?.apartmentStyle ||
      room?.apartmentType ||
      room?.description ||
      property?.propertyName ||
      'Apartment';
    const unit = room?.roomId != null ? `Unit ${room.roomId}` : '';
    const address = [property?.streetAddress, property?.city, property?.state]
      .filter(Boolean)
      .join(', ');
    return [apartmentName, unit, address].filter(Boolean).join(' · ');
  }

  private formatScheduledVisit(maintenance: any): string | undefined {
    if (!maintenance?.scheduledDate) {
      return undefined;
    }

    const date = new Intl.DateTimeFormat('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Lagos',
    }).format(new Date(maintenance.scheduledDate));
    if (!maintenance.scheduledTime) {
      return date;
    }

    const [hours, minutes] = maintenance.scheduledTime.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return `${date} at ${maintenance.scheduledTime}`;
    }

    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const time = `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
    return `${date} at ${time}`;
  }

  private async sendLifecycleNotification(
    maintenanceId: string,
    event: 'created' | 'scheduled' | 'status',
  ): Promise<void> {
    const maintenance: any = await this.maintenanceModel
      .findById(maintenanceId)
      .populate({
        path: 'roomId',
        populate: {
          path: 'propertyId',
          populate: { path: 'createdBy' },
        },
      })
      .populate('createdBy')
      .lean();
    if (!maintenance) {
      return;
    }

    const tenant = maintenance.createdBy;
    const landlord = maintenance.roomId?.propertyId?.createdBy;
    const propertyLabel = this.formatPropertyLabel(maintenance);
    const requestNumber = maintenance.maintenanceId;
    const requestTitle = maintenance.title;
    const status = maintenance.status;
    const frontendUrl = (
      process.env.FRONTEND_URL || 'https://www.naijarentverify.com'
    ).replace(/\/+$/, '');
    const tenantActionUrl = `${frontendUrl}/dashboard/tenant/rented-properties/maintenance/single/${maintenance._id}`;
    const landlordActionUrl = `${frontendUrl}/dashboard/landlord/properties/maintenance/${maintenance._id}`;
    const metadata = {
      maintenanceId: String(maintenance._id),
      requestNumber,
      roomId: String(maintenance.roomId?._id || ''),
      propertyId: String(maintenance.roomId?.propertyId?._id || ''),
      status,
      assignedTo: maintenance.assignedTo,
      assigneePhoneNumber: maintenance.assigneePhoneNumber,
      scheduledDate: maintenance.scheduledDate,
      scheduledTime: maintenance.scheduledTime,
    };

    if (event === 'created' && landlord?._id && landlord?.email) {
      const message = `${this.formatPersonName(tenant)} logged a new maintenance request for ${propertyLabel}.`;
      await Promise.allSettled([
        this.notificationsService.create({
          targetRole: 'landlord',
          userId: String(landlord._id),
          type: 'maintenance_created',
          title: `New maintenance request #${requestNumber}`,
          body: message,
          metadata: { ...metadata, actionUrl: landlordActionUrl },
        }),
        this.emailService.sendMaintenanceNotification({
          recipientEmail: landlord.email,
          recipientName: this.formatPersonName(landlord),
          subject: `New maintenance request #${requestNumber}: ${requestTitle}`,
          heading: 'A tenant logged a maintenance request',
          message,
          requestTitle,
          requestNumber,
          propertyLabel,
          status,
          actionUrl: landlordActionUrl,
          actionLabel: 'Review maintenance request',
        }),
      ]);
      return;
    }

    if (event === 'scheduled' && tenant?._id && tenant?.email) {
      const scheduledVisit = this.formatScheduledVisit(maintenance);
      const message = `${maintenance.assignedTo} has been scheduled to inspect your maintenance request${scheduledVisit ? ` on ${scheduledVisit}` : ''}.`;
      await Promise.allSettled([
        this.notificationsService.create({
          targetRole: 'tenant',
          userId: String(tenant._id),
          type: 'maintenance_scheduled',
          title: `Vendor scheduled for request #${requestNumber}`,
          body: message,
          metadata: { ...metadata, actionUrl: tenantActionUrl },
        }),
        this.emailService.sendMaintenanceNotification({
          recipientEmail: tenant.email,
          recipientName: this.formatPersonName(tenant),
          subject: `Vendor scheduled for maintenance request #${requestNumber}`,
          heading: 'Your maintenance inspection has been scheduled',
          message,
          requestTitle,
          requestNumber,
          propertyLabel,
          status,
          vendorName: maintenance.assignedTo,
          vendorPhone: maintenance.assigneePhoneNumber,
          scheduledVisit,
          note: maintenance.extraNoteToTenant,
          actionUrl: tenantActionUrl,
        }),
      ]);
      return;
    }

    if (event !== 'status') {
      return;
    }

    const message = `Maintenance request #${requestNumber} is now ${status}.`;
    const recipients = [
      {
        user: tenant,
        role: 'tenant',
        actionUrl: tenantActionUrl,
      },
      {
        user: landlord,
        role: 'landlord',
        actionUrl: landlordActionUrl,
      },
    ].filter(({ user }) => user?._id && user?.email);
    await Promise.allSettled(
      recipients.flatMap(({ user, role, actionUrl }) => [
        this.notificationsService.create({
          targetRole: role,
          userId: String(user._id),
          type: 'maintenance_status_updated',
          title: `Maintenance request #${requestNumber}: ${status}`,
          body: message,
          metadata: { ...metadata, actionUrl },
        }),
        this.emailService.sendMaintenanceNotification({
          recipientEmail: user.email,
          recipientName: this.formatPersonName(user),
          subject: `Maintenance request #${requestNumber} is ${status}`,
          heading: 'Maintenance request status updated',
          message,
          requestTitle,
          requestNumber,
          propertyLabel,
          status,
          vendorName: maintenance.assignedTo,
          vendorPhone: maintenance.assigneePhoneNumber,
          scheduledVisit: this.formatScheduledVisit(maintenance),
          note: maintenance.extraNoteToTenant,
          actionUrl,
        }),
      ]),
    );
  }

  async findAll(createdBy: any, roomId: any): Promise<Maintenance[]> {
    try {
      return await this.maintenanceModel
        .find({ createdBy, roomId })
        .populate({
          path: 'roomId',
          populate: {
            path: 'propertyId',
          },
        })
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }

  async findAllByOwnerId(
    ownerId: string,
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ) {
    try {
      const allRecords = await this.maintenanceModel
        .find()
        .populate({
          path: 'roomId',
          populate: {
            path: 'propertyId',
          },
        })
        .populate('createdBy')
        .sort({ createdAt: -1 })
        .exec();

      const filteredByOwner = allRecords.filter((record) => {
        const property: any = record.roomId?.propertyId;
        if (!property || !property.createdBy) return false;
        if (property.createdBy instanceof mongoose.Types.ObjectId) {
          return property.createdBy.equals(ownerId);
        }
        return property.createdBy === ownerId;
      });

      const normalizedStatus =
        status?.trim().toLowerCase() === 'completed'
          ? MaintenanceStatus.RESOLVED
          : status?.trim();
      let filtered = normalizedStatus
        ? (() => {
            const statusKey = String(normalizedStatus).toLowerCase();
            if (statusKey === 'new' || statusKey === 'active') {
              return filteredByOwner.filter((item) =>
                ['new', 'acknowledged'].includes(
                  String(item.status || '').toLowerCase(),
                ),
              );
            }
            return filteredByOwner.filter(
              (item) => item.status?.toLowerCase() === statusKey,
            );
          })()
        : filteredByOwner;

      if (search) {
        const keyword = search.toLowerCase();
        filtered = filtered.filter((item) => {
          const apartmentType = item.roomId?.apartmentType?.toLowerCase() || '';
          const address =
            item.roomId?.propertyId?.streetAddress?.toLowerCase() || '';
          const title = item.title?.toLowerCase() || '';
          const description = item.description?.toLowerCase() || '';
          const maintenanceId = item.maintenanceId?.toString() || '';
          return (
            apartmentType.includes(keyword) ||
            address.includes(keyword) ||
            title.includes(keyword) ||
            description.includes(keyword) ||
            maintenanceId.includes(keyword)
          );
        });
      }
      const summary: Record<string, number> = {};
      // Summarize based on the filtered data
      filteredByOwner.forEach((item) => {
        const status = item.status || 'unknown';
        summary[status] = (summary[status] || 0) + 1;
      });
      summary.Emergency = filteredByOwner.filter(
        (item) => item.priority === 'Emergency',
      ).length;
      summary.openTickets =
        (summary.New || 0) + (summary.Acknowledged || 0);

      return {
        ...paginateAndSummarize(filtered, page, limit, [
          'New',
          'In Progress',
          'Resolved',
          'Emergency',
        ]),
        summary,
      };
    } catch (error) {
      throw new Error(`Failed to fetch records: ${error.message}`);
    }
  }

  async findMaintenancePerApartment(
    roomId: string,
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ): Promise<any> {
    try {
      const allRecords = await this.maintenanceModel
        .find({ roomId })
        .populate({
          path: 'roomId',
          populate: {
            path: 'propertyId',
          },
        })
        .sort({ createdAt: -1 })
        .exec();

      let filtered = status
        ? allRecords.filter(
            (item) => item.status?.toLowerCase() === status.toLowerCase(),
          )
        : allRecords;

      if (search) {
        const keyword = search.toLowerCase();
        filtered = allRecords.filter((item) => {
          const apartmentType = item.roomId?.apartmentType?.toLowerCase() || '';
          const address =
            item.roomId?.propertyId?.streetAddress?.toLowerCase() || '';
          const title = item.title?.toLowerCase() || '';
          const maintenanceId = item.maintenanceId.toString() || '';
          const description = item.description?.toLowerCase() || '';
          return (
            apartmentType.includes(keyword) ||
            address.includes(keyword) ||
            title.includes(keyword) ||
            description.includes(keyword) ||
            maintenanceId.includes(keyword)
          );
        });
      }

      return paginateAndSummarize(filtered, page, limit, [
        'New',
        'In Progress',
        'Completed',
        'Emergency',
      ]);
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Maintenance | null> {
    try {
      return await this.maintenanceModel
        .findById(id)
        .populate({
          path: 'roomId',
          populate: {
            path: 'propertyId',
          },
        })
        .populate('createdBy')
        .exec();
    } catch (error) {
      throw new NotFoundException(`Maintenance with ID ${id} not found.`);
    }
  }

  async updateMaintenanceStatus(
    id: string,
    status: string,
  ): Promise<Maintenance | null> {
    try {
      if (
        !Object.values(MaintenanceStatus).includes(status as MaintenanceStatus)
      ) {
        throw new BadRequestException('Invalid maintenance status');
      }

      const currentMaintenance = await this.maintenanceModel.findById(id);
      if (!currentMaintenance) {
        throw new NotFoundException('Maintenance not found');
      }
      if (currentMaintenance.status === status) {
        return currentMaintenance;
      }

      const updatedMaintenance = await this.maintenanceModel.findByIdAndUpdate(
        id,
        {
          $set: { status },
          $push: {
            statusHistory: {
              status,
              changedAt: new Date(),
              note: `Status updated to ${status}`,
            },
          },
        },
        { new: true },
      );

      if (updatedMaintenance) {
        this.queueLifecycleNotification(id, 'status');
      }
      return updatedMaintenance;
    } catch (error) {
      throw new Error(
        `Failed to update maintenance with ID ${id}: ${error.message}`,
      );
    }
  }

  async remove(id: string): Promise<Maintenance | null> {
    try {
      return await this.maintenanceModel.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(
        `Failed to delete maintenance with ID ${id}: ${error.message}`,
      );
    }
  }

  async findAllMaintenanceByTenantId(id: any): Promise<Maintenance[]> {
    try {
      const maintenanceRecords = await this.maintenanceModel
        .find({ createdBy: id })
        .populate({
          path: 'roomId',
          populate: { path: 'propertyId' },
        })
        .sort({ createdAt: -1 })
        .exec();

      return maintenanceRecords;
    } catch (error) {
      throw new Error(`Failed to fetch maintenance records: ${error.message}`);
    }
  }
}
