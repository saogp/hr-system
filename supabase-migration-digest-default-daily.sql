alter table profiles alter column email_digest_mode set default 'daily';
update profiles set email_digest_mode = 'daily' where email_digest_mode = 'immediate';
