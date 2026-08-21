<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SecuritySetting extends Model
{
    protected $table = 'security_settings';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['singleton', 'mfa_enabled', 'mfa_provider', 'mfa_code_length', 'mfa_code_expiry', 'mfa_lockout_attempts'];


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
