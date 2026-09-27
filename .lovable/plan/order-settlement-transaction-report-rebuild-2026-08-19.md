# Order settlement + Transaction report (rebuild)

Goal: courier-er por ja ghote (delivered / partial / return / damage) tar jonno ekta clear status flow, per-order admin+reseller calculation, ar ekta shohoj **Transaction report** ja purono "Money timeline / Reseller earning" report replace korbe.

## 1. Status flow (new)

#

```text
reseller:  pending ──"Send to admin"──> forwarded   (edit/delete/status only while pending)
admin:     forwarded ──> confirmed ──> packaging ──> ready_to_ship ──> to courier (shipped)
webhook:   delivered            -> delivered
           partial (courier)    -> pending_partial
           any return family    -> pending_return
admin only (webhook ar change korbe na):
           pending_return  -> returned            (parcel receive)
           pending_partial -> partial_full        (full item, kom/besi cod)
                           -> partial_item        (kichu item ferot)
                           -> partial_delivery    (only delivery charge diye full ferot)
           delivered/returned/partial_* -> damaged  (item damage/missing mark)
```

- `confirmed` hoye gele reseller-er edit / delete / status access off.
- Partial settle korar somoy admin/staff **received amount** boshabe, ar `partial_item` hole **kon item ferot eseche** (per-item returned qty) manually boshabe.
- Stock reverse: `returned`, `partial_item` (ferot qty), `partial_delivery` (full qty), `cancelled`, order delete — sob khetre.

## 2. Money math (single source of truth)

Admin cost = product cost (admin reseller_price, received item onujayi) + delivery charge (admin-set/default) + packaging cost.
Reseller sale = customer received amount (discount ar reseller price already order-e).

| Status           | Received                                    | Cost                                      | Reseller profit                |
| ---------------- | ------------------------------------------- | ----------------------------------------- | ------------------------------ |
| delivered        | full cod (paid order hole 0 + already paid) | product+delivery+pack                     | received − cost                |
| partial_full     | admin-boshano amount                        | full cost                                 | received − cost                |
| partial_item     | admin-boshano amount                        | only received item cost + delivery + pack | received − cost                |
| partial_delivery | shudhu delivery charge amount               | delivery + pack                           | received − (delivery+pack)     |
| returned         | 0                                           | delivery + pack                           | −(delivery + pack)             |
| damaged          | jotota collect hoyeche                      | product+delivery+pack                     | received − cost (loss dekhabe) |

Reseller-er product price / discount change = reseller-er nijer porshon (admin profit-e count hobe na). Admin delivery charge / packaging change = oi order-e apply hobe, ar note-e log thakbe.

## 3. Data changes

- `order_status` enum: add `packaging`, `pending_partial`, `partial_full`, `partial_item`, `partial_delivery`, `damaged` (purono `partial` map kore `partial_full`-e).
- `order_items`: `returned_qty int default 0`.
- `orders`: `settlement_note text`, `settled_by`, `settled_at`, `damage_note`.
- `order_transactions` table (append-only ledger): order_id, reseller_id, kind (`order_sale`, `order_cost`, `profit`, `loss`, `deposit`, `withdraw`, `adjustment`), amount, note (dynamic ba manual), created_by, created_at + GRANT + RLS (reseller nijer, admin sob).
- Triggers: settlement holei profit/loss transaction likhbe + stock reverse korbe; `sync_order_profit` notun math onujayi update.

## 4. UI

- **Order settle modal** (admin/staff): status choice (delivered / partial 3 type / returned received / damaged), received amount, per-item returned qty, note — ar live profit preview (admin cost vs reseller profit).
- **Order edit**: delivery charge + packaging edit admin-only, change hole auto note.
- **Transaction report** (`/admin/transactions` + `/reseller/transactions`) — screenshot-er moto simple table: S.I., Type (Deposit/Withdraw/Profit/Loss), Amount, Date, Status, Meta (Order #x is DELIVERED link), Subtotal (Buy/Sell), Delivery (Buy/Sell), Packaging, Total, Note, Actions. Search + date filter + reseller filter (admin) + running balance + top summary (Available balance, Total in/out) + CSV/Excel export.
- Purono `admin/reseller-earning` + `reseller/earnings` timeline ei notun report diye replace hobe; payout/deposit tab thakbe.

## 5. Technical notes

- Sob math `src/lib/finance-report.ts`-e ekta `settleOrder()` helper-e jabe, DB trigger same formula rakhbe.
- Status flow + allowed transitions `src/lib/courier-status.ts`-e (role-aware `nextStatuses()`).
- Courier webhook map update: partial → `pending_partial`, return family → `pending_return` (already), delivered → `delivered`; er bahire webhook kono status change korbe na.
