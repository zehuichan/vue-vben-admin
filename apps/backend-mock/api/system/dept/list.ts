import { faker } from '@faker-js/faker';
import { eventHandler } from 'h3';
import { useResponseSuccess } from '~/utils/response';
import { getTenantSeed } from '~/utils/tenant-scope';
import { verifyTenantAccess } from '~/utils/tenant-utils';

const formatterCN = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function generateMockDataList(count: number) {
  const dataList = [];

  for (let i = 0; i < count; i++) {
    const dataItem: Record<string, any> = {
      id: faker.string.uuid(),
      pid: 0,
      name: faker.commerce.department(),
      status: faker.helpers.arrayElement([0, 1]),
      createTime: formatterCN.format(
        faker.date.between({ from: '2021-01-01', to: '2022-12-31' }),
      ),
      remark: faker.lorem.sentence(),
    };
    if (faker.datatype.boolean()) {
      dataItem.children = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => ({
          id: faker.string.uuid(),
          pid: dataItem.id,
          name: faker.commerce.department(),
          status: faker.helpers.arrayElement([0, 1]),
          createTime: formatterCN.format(
            faker.date.between({ from: '2023-01-01', to: '2023-12-31' }),
          ),
          remark: faker.lorem.sentence(),
        }),
      );
    }
    dataList.push(dataItem);
  }

  return dataList;
}

const tenantDeptList = new Map<string, Record<string, any>[]>();

function getTenantDeptList(tenantCode: string) {
  let deptList = tenantDeptList.get(tenantCode);
  if (!deptList) {
    faker.seed(getTenantSeed(tenantCode));
    deptList = generateMockDataList(faker.number.int({ min: 4, max: 10 }));
    tenantDeptList.set(tenantCode, deptList);
  }
  return deptList;
}

export default eventHandler(async (event) => {
  const access = verifyTenantAccess(event);
  if (access.response) {
    return access.response;
  }

  return useResponseSuccess(
    structuredClone(getTenantDeptList(access.userinfo.tenantCode)),
  );
});
