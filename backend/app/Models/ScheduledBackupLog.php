<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduledBackupLog extends Model
{
    protected $table = 'scheduled_backup_logs';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['scheduled_backup_id', 'status', 'filename', 'size', 'error', 'started_at', 'completed_at'];


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
