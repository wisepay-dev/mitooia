import prisma from '../app/lib/prisma';

async function main() {
  const orderId = 'cmszinigr000904jzqr6zeafv';

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { credits: true, generations: true }
  });

  if (!order) {
    console.log('Order not found');
    return;
  }

  console.log('ORDER STATUS:', order.status);
  
  if (order.status !== 'PAID') {
    console.log('Order not PAID');
    return;
  }

  const hasSuccess = order.generations.some(g => g.status === 'SUCCESS' || g.status === 'COMPLETED');
  if (hasSuccess) {
    console.log('Order already has successful generation');
    return;
  }

  const failedGenerations = order.generations.filter(g => g.status === 'FAILED');
  console.log('FAILED GENERATIONS:', failedGenerations.length);

  const usedCredit = order.credits.find(c => c.used > 0);
  if (!usedCredit) {
    console.log('No used credit found');
    return;
  }

  console.log('USED CREDIT:', usedCredit.id, 'USED AMOUNT:', usedCredit.used);

  if (failedGenerations.length > 0 && usedCredit) {
    await prisma.generationCredit.update({
      where: { id: usedCredit.id },
      data: { used: { decrement: 1 } }
    });
    console.log('CREDIT RESTORED SUCCESSFULLY');
  } else {
    console.log('CONDITIONS NOT MET');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
