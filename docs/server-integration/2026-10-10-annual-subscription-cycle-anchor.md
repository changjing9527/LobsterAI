# 年付权益周期锚点

## Change Summary

`GET /api/subscription` 为生效中的年付订阅新增 `cycleAnchorDate`。该字段供权益周期展示使用，不改变支付、扣费或订阅周期推进逻辑。

## Endpoint Details

- Method / Path：`GET /api/subscription`
- Headers：`Authorization: Bearer <accessToken>`；Cookie/session 调用仍沿用原认证。
- Request Body：无。

响应示例（省略其他既有字段）：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "subscriptionStatus": "active",
    "billingPeriod": "annual",
    "cycleAnchorDate": "2026-01-31",
    "grantTotalMonths": 12,
    "annualCurrentMonth": 3,
    "grantRemainingMonths": 9,
    "currentPeriodStart": "2026-03-31T00:00:00",
    "currentPeriodEnd": "2026-04-29T23:59:59",
    "entitlementEndAt": "2027-01-30T23:59:59"
  }
}
```

`cycleAnchorDate` 为保存的最初年付生效日期，格式 `YYYY-MM-DD`，可为 null。仅生效中的年付响应提供该字段。

## Frontend Action Items

现有客户端可继续忽略该可选字段，无需修改支付或登录调用。如展示完整周期列表，按实际 `grantTotalMonths` 生成周期，用 `annualCurrentMonth` 标记当前月；历史15个月权益不可固定为12个月。

每期都从原始锚点加日历月计算，目标月缺少该日时取月底；结束日为下一期开始日前一天。避免从当前周期逆推锚点或从上期递推，防止29/30/31日和闰年日期偏移。缺少字段时不要生成模拟周期。

## Auth Requirements

沿用 JWT Bearer 认证及既有用户权限，无新增权限。

## Notes & Caveats

兼容字段扩展，先发布 server；无需新增数据库迁移。年付待生效时仍显示当前月付状态，生效后才显示年付周期。年付升级保持原始锚点和总月数。
