<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduledBackup extends Model
{
    protected $table = 'scheduled_backups';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['singleton', 'enabled', 'frequency', 'time', 'provider', 'retention_days', 'last_run_at', 'next_run_at'];


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
