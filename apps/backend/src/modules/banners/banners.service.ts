import prisma from '../../config/database';

export async function getAllBanners(onlyActive: boolean = true) {
    return prisma.banner.findMany({
        where: onlyActive ? { is_active: true } : undefined,
        orderBy: { sort_order: 'asc' },
    });
}

export async function createBanner(data: {
    title?: string;
    image_url: string;
    link_url?: string;
    is_active?: boolean;
    sort_order?: number;
}) {
    return prisma.banner.create({
        data,
    });
}

export async function updateBanner(
    id: string,
    data: {
        title?: string;
        image_url?: string;
        link_url?: string;
        is_active?: boolean;
        sort_order?: number;
    }
) {
    return prisma.banner.update({
        where: { id },
        data,
    });
}

export async function deleteBanner(id: string) {
    return prisma.banner.delete({
        where: { id },
    });
}
