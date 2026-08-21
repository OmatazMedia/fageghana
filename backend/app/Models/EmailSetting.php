<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailSetting extends Model
{
    protected $table = 'email_settings';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['singleton', 'primary_provider', 'smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from', 'resend_enabled', 'resend_api_key', 'resend_from'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
